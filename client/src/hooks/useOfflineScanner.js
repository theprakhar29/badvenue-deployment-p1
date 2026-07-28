import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../api/client.js";
import * as offlineDb from "../utils/offlineDb.js";

function generateClientScanId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Wraps everything needed for offline-first scanning: caches the event's
 * ticket manifest locally, verifies scans online-first with an offline
 * fallback, queues offline scans for later sync, and retries that sync
 * automatically when connectivity returns.
 *
 * NOTE ON CONFLICT RESOLUTION: if the same ticket is scanned on two
 * different offline devices before either syncs, both will locally show
 * VALID (each device only knows its own cached copy). When they sync,
 * whichever scan's sync request reaches the server FIRST wins (the
 * server's atomic compare-and-swap accepts it); the second is correctly
 * marked ALREADY_USED once its sync completes. This is "first-to-sync
 * wins," not "first-to-actually-scan wins" — the two can differ if the
 * loser had better connectivity and synced sooner despite scanning later.
 * True chronological ordering across independent devices would need
 * synchronized clocks we can't guarantee, so this is a deliberate,
 * documented simplification rather than an oversight.
 */
export function useOfflineScanner({ manifestPath, verifyPath, syncPath }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queuedCount, setQueuedCount] = useState(0);
  const [manifestReady, setManifestReady] = useState(false);
  const syncingRef = useRef(false);

  const refreshQueueCount = useCallback(async () => {
    try {
      setQueuedCount(await offlineDb.queuedScanCount());
    } catch {
      // IndexedDB unavailable (rare, e.g. private browsing in some
      // browsers) — offline mode just won't work on this device; online
      // scanning is unaffected.
    }
  }, []);

  const loadManifest = useCallback(async () => {
    try {
      const data = await api.get(manifestPath);
      await offlineDb.saveManifest(data.tickets);
      setManifestReady(true);
    } catch {
      // Couldn't fetch a fresh manifest (e.g. link opened while already
      // offline). Any manifest cached from a prior session on this device
      // is still usable; if there's none, offline scans will show
      // "not found" until connectivity returns and this succeeds.
      setManifestReady(false);
    }
  }, [manifestPath]);

  const syncQueued = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      const queued = await offlineDb.getQueuedScans();
      if (queued.length === 0) return;

      const { results } = await api.post(syncPath, {
        scans: queued.map((q) => ({
          qrToken: q.qrToken,
          clientScanId: q.clientScanId,
          scannedAt: q.scannedAt,
        })),
      });

      for (const result of results) {
        await offlineDb.clearQueuedScan(result.clientScanId);
      }
      await refreshQueueCount();
    } catch {
      // Still offline or the request failed — scans stay queued, we'll
      // retry on the next reconnect event or periodic check.
    } finally {
      syncingRef.current = false;
    }
  }, [syncPath, refreshQueueCount]);

  useEffect(() => {
    loadManifest();
    refreshQueueCount();

    function handleOnline() {
      setIsOnline(true);
      syncQueued();
    }
    function handleOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Belt-and-suspenders: browsers' online/offline events fire on a clean
    // disconnect, but flaky Wi-Fi (weak signal, not a clean drop) doesn't
    // always trigger them reliably. This catches that case too.
    const interval = setInterval(() => {
      if (navigator.onLine) syncQueued();
    }, 15000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verifyOffline = useCallback(
    async (qrToken, clientScanId, scannedAt) => {
      const local = await offlineDb.getLocalTicket(qrToken);

      if (!local) {
        return {
          result: "INVALID",
          message: "Not found in this device's offline list.",
          offline: true,
        };
      }
      if (local.status === "USED") {
        return {
          result: "ALREADY_USED",
          message: "Already scanned (offline record).",
          ticket: local,
          offline: true,
        };
      }

      await offlineDb.markLocalTicketUsed(qrToken);
      await offlineDb.queueScan({ qrToken, clientScanId, scannedAt });
      await refreshQueueCount();

      return {
        result: "VALID",
        message: "Entry approved — offline, will sync when back online.",
        ticket: local,
        offline: true,
      };
    },
    [refreshQueueCount]
  );

  const verify = useCallback(
    async (qrToken) => {
      const clientScanId = generateClientScanId();
      const scannedAt = new Date().toISOString();

      if (navigator.onLine) {
        try {
          const result = await api.post(verifyPath, { qrToken, clientScanId, scannedAt });
          if (result.result === "VALID") await offlineDb.markLocalTicketUsed(qrToken);
          return { ...result, offline: false };
        } catch {
          // Request failed even though navigator.onLine said we're
          // connected (e.g. the connection dropped mid-request, or the
          // server itself is unreachable). Fall back to the local record
          // rather than blocking the scan.
          return verifyOffline(qrToken, clientScanId, scannedAt);
        }
      }

      return verifyOffline(qrToken, clientScanId, scannedAt);
    },
    [verifyPath, verifyOffline]
  );

  return { isOnline, queuedCount, manifestReady, verify, syncNow: syncQueued };
}
