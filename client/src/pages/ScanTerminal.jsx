import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client.js";
import { useOfflineScanner } from "../hooks/useOfflineScanner.js";
import ScanConsole from "../components/ScanConsole.jsx";

export default function ScanTerminal() {
  const { token } = useParams();
  const [status, setStatus] = useState("loading"); // loading | ok | error
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get(`/public/scanner-links/${token}/activate`)
      .then((data) => {
        setSession(data);
        setStatus("ok");
      })
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
  }, [token]);

  const { isOnline, queuedCount, verify, syncNow } = useOfflineScanner({
    manifestPath: "/scanner/offline-manifest",
    verifyPath: "/scanner/verify",
    syncPath: "/scanner/sync-scans",
  });

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950 text-paper/60">
        Activating scanner…
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-navy-950 px-6 text-center text-paper">
        <h1 className="font-display text-3xl">Scanner link unavailable</h1>
        <p className="max-w-sm text-paper/60">{error}</p>
        <p className="text-sm text-paper/40">
          Ask the organizer to send you a new link — links can be deactivated
          instantly from their dashboard.
        </p>
      </div>
    );
  }

  return (
    <ScanConsole
      eventTitle={session.eventTitle}
      subtitle={session.label ? `Scanning as: ${session.label}` : "Entry scanner"}
      verify={verify}
      isOnline={isOnline}
      queuedCount={queuedCount}
      onSyncNow={syncNow}
    />
  );
}
