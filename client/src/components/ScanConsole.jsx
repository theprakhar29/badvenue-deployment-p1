import { useState, useRef, useEffect } from "react";
import { playBeep } from "../utils/beep.js";
import CameraScanner from "./CameraScanner.jsx";

const RESULT_STYLES = {
  VALID: { bg: "bg-emerald-600", label: "VALID — Entry approved" },
  ALREADY_USED: { bg: "bg-stub-500", label: "ALREADY SCANNED" },
  INVALID: { bg: "bg-stub-500", label: "INVALID TICKET" },
  NOT_AUTHORIZED: { bg: "bg-stub-500", label: "WRONG EVENT" },
};

export default function ScanConsole({
  eventTitle,
  subtitle,
  verify, // async (qrToken) => result
  isOnline,
  queuedCount,
  onSyncNow,
}) {
  const [mode, setMode] = useState("camera"); // "camera" | "manual"
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const inputRef = useRef(null);
  const processingRef = useRef(false); // guards against camera firing while a result is showing

  useEffect(() => {
    if (mode === "manual") inputRef.current?.focus();
  }, [mode, result]);

  async function processCode(rawCode) {
    if (!rawCode || processingRef.current) return;
    processingRef.current = true;
    setSubmitting(true);
    try {
      const data = await verify(rawCode);
      setResult(data);
      setScanCount((c) => c + 1);
      playBeep(data.result === "VALID" ? "valid" : "invalid");
    } catch (err) {
      setResult({ result: "INVALID", message: err.message });
      playBeep("invalid");
    } finally {
      setSubmitting(false);
    }
  }

  function handleManualSubmit(e) {
    e.preventDefault();
    const value = code.trim();
    setCode("");
    processCode(value);
  }

  function dismissResult() {
    setResult(null);
    processingRef.current = false;
  }

  const style = result ? RESULT_STYLES[result.result] : null;

  return (
    <div className="flex min-h-screen flex-col bg-navy-950 text-paper">
      <div className="border-b border-paper/10 px-6 py-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-500">{subtitle}</p>
            <h1 className="font-display text-2xl tracking-wide">{eventTitle}</h1>
            <p className="mt-1 text-xs text-paper/40">
              {scanCount} scan{scanCount === 1 ? "" : "s"} this session
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider ${
                isOnline ? "bg-emerald-500/15 text-emerald-400" : "bg-stub-500/15 text-stub-400"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-emerald-400" : "bg-stub-400"}`} />
              {isOnline ? "Online" : "Offline"}
            </span>
            {queuedCount > 0 && (
              <button
                onClick={onSyncNow}
                className="rounded-full bg-amber-500/15 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-amber-400 hover:bg-amber-500/25"
              >
                {queuedCount} pending sync
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Full-screen high-contrast result state */}
      {result && (
        <div
          className={`flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center ${style.bg}`}
        >
          <p className="font-display text-5xl tracking-wide text-white">{style.label}</p>
          {result.ticket?.tierName && (
            <p className="font-mono text-lg text-white/90">{result.ticket.tierName}</p>
          )}
          {result.offline && (
            <p className="rounded-full bg-white/15 px-3 py-1 text-xs text-white/80">
              Recorded offline — will sync automatically
            </p>
          )}
          {result.message && <p className="max-w-md text-white/80">{result.message}</p>}
          <button
            onClick={dismissResult}
            className="mt-6 rounded-md bg-white/15 px-6 py-3 text-sm font-medium text-white hover:bg-white/25"
          >
            Scan next ticket
          </button>
        </div>
      )}

      {/* Scan input: camera by default, manual entry as fallback */}
      {!result && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-8">
          <div className="flex gap-2 rounded-full bg-navy-800 p-1">
            <button
              onClick={() => setMode("camera")}
              className={`rounded-full px-4 py-1.5 text-sm ${mode === "camera" ? "bg-amber-500 text-navy-950" : "text-paper/60"}`}
            >
              Camera
            </button>
            <button
              onClick={() => setMode("manual")}
              className={`rounded-full px-4 py-1.5 text-sm ${mode === "manual" ? "bg-amber-500 text-navy-950" : "text-paper/60"}`}
            >
              Manual entry
            </button>
          </div>

          {mode === "camera" ? (
            <CameraScanner onDecode={processCode} />
          ) : (
            <form onSubmit={handleManualSubmit} className="flex w-full max-w-md flex-col gap-3">
              <input
                ref={inputRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ticket code"
                autoFocus
                className="rounded-md border border-paper/20 bg-navy-800 px-4 py-3 text-center font-mono text-lg text-paper placeholder:text-paper/30 focus:border-amber-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={submitting || !code.trim()}
                className="rounded-md bg-amber-500 px-6 py-3 font-medium text-navy-950 hover:bg-amber-600 disabled:opacity-50"
              >
                {submitting ? "Checking…" : "Verify ticket"}
              </button>
            </form>
          )}

          {!isOnline && (
            <p className="max-w-sm text-center text-xs text-amber-500/80">
              You're offline — scans are still validated against the cached
              ticket list on this device and will sync automatically once
              you're back online.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
