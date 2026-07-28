import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import OrganizerLayout from "../../components/OrganizerLayout.jsx";
import Button from "../../components/Button.jsx";
import EventStatusControl from "../../components/EventStatusControl.jsx";
import { api } from "../../api/client.js";

const statusStyles = {
  DRAFT: "bg-navy-950/10 text-navy-950",
  PUBLISHED: "bg-amber-500/20 text-amber-600",
  PAUSED: "bg-stub-500/10 text-stub-600",
  CLOSED: "bg-navy-950/10 text-ink/50",
};

export default function Dashboard() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  function loadEvents() {
    setLoading(true);
    api
      .get("/events/mine")
      .then(setEvents)
      .finally(() => setLoading(false));
  }

  useEffect(loadEvents, []);

  function handleUpdated(updated) {
    setEvents((prev) => prev.map((e) => (e._id === updated._id ? updated : e)));
  }

  return (
    <OrganizerLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-wide text-navy-950">Your events</h1>
          <p className="mt-1 text-sm text-ink/60">
            {loading
              ? "Loading…"
              : events.length === 0
              ? "Nothing here yet — create your first event."
              : `${events.length} event${events.length === 1 ? "" : "s"} total`}
          </p>
        </div>
        <Link to="/organizer/events/new">
          <Button>+ New event</Button>
        </Link>
      </div>

      <div className="stub-divider my-8" />

      {!loading && events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-navy-950/20 bg-white px-6 py-16 text-center">
          <p className="font-body text-ink/60">
            Once you create an event, it&rsquo;ll show up here with live sales numbers.
          </p>
          <Link to="/organizer/events/new">
            <Button className="mt-6">Create your first event</Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map((event) => {
            const soldTotal = event.pricingTiers.reduce((s, t) => s + t.soldQty, 0);
            const capTotal = event.pricingTiers.reduce((s, t) => s + t.totalQty, 0);
            return (
              <div
                key={event._id}
                className="flex items-center justify-between rounded-lg border border-navy-950/10 bg-white px-5 py-4"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-display text-xl tracking-wide text-navy-950">
                      {event.title}
                    </h3>
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider ${statusStyles[event.status]}`}
                    >
                      {event.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink/60">
                    {event.startAt
                      ? new Date(event.startAt).toLocaleDateString(undefined, { dateStyle: "medium" })
                      : "Date TBA"}{" "}
                    · {soldTotal}/{capTotal || "—"} tickets sold
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <Link
                    to={`/organizer/events/${event._id}/form`}
                    className="text-sm text-amber-600 hover:underline"
                  >
                    Edit form
                  </Link>
                  <Link
                    to={`/organizer/events/${event._id}/scanners`}
                    className="text-sm text-amber-600 hover:underline"
                  >
                    Scanners
                  </Link>
                  <span className="font-mono text-xs text-ink/40">/{event.slug}</span>
                  <EventStatusControl event={event} onUpdated={handleUpdated} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </OrganizerLayout>
  );
}
