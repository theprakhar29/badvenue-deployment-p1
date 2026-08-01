import { useState } from "react";
import Button from "./Button.jsx";
import { api } from "../api/client.js";

export default function EventStatusControl({ event, onUpdated }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function setStatus(next) {
    setLoading(true);
    setError(null);
    try {
      const updated = await api.patch(`/events/${event._id}/status`, { status: next });
      onUpdated(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {event.status === "DRAFT" && (
          <Button
            variant="primary"
            className="px-3 py-1.5 text-xs"
            disabled={loading}
            onClick={() => setStatus("PUBLISHED")}
          >
            Publish
          </Button>
        )}
        {event.status === "PUBLISHED" && (
          <Button
            variant="ghost"
            className="px-3 py-1.5 text-xs"
            disabled={loading}
            onClick={() => setStatus("PAUSED")}
          >
            Pause sales
          </Button>
        )}
        {event.status === "PAUSED" && (
          <Button
            variant="primary"
            className="px-3 py-1.5 text-xs"
            disabled={loading}
            onClick={() => setStatus("PUBLISHED")}
          >
            Resume
          </Button>
        )}
      </div>
      {error && <p className="max-w-[200px] text-right text-xs text-stub-500">{error}</p>}
    </div>
  );
}
