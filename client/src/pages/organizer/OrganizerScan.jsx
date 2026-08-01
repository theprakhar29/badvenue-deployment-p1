import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../api/client.js";
import { useOfflineScanner } from "../../hooks/useOfflineScanner.js";
import ScanConsole from "../../components/ScanConsole.jsx";

export default function OrganizerScan() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    api
      .get(`/events/${id}`)
      .then((data) => {
        setEvent(data);
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, [id]);

  const { isOnline, queuedCount, verify, syncNow } = useOfflineScanner({
    manifestPath: `/events/${id}/offline-manifest`,
    verifyPath: `/events/${id}/verify`,
    syncPath: `/events/${id}/sync-scans`,
  });

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950 text-paper/60">
        Loading…
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-navy-950 text-paper">
        <p>Couldn&rsquo;t load this event.</p>
        <Link to="/organizer/dashboard" className="text-amber-500 hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <ScanConsole
      eventTitle={event.title}
      subtitle="Scanning as host"
      verify={verify}
      isOnline={isOnline}
      queuedCount={queuedCount}
      onSyncNow={syncNow}
    />
  );
}
