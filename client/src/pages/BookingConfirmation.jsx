import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client.js";

export default function BookingConfirmation() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    api
      .get(`/public/bookings/${id}`)
      .then((data) => {
        setBooking(data);
        setStatus("ok");
      })
      .catch(() => setStatus("not-found"));
  }, [id]);

  if (status === "loading") {
    return <p className="mx-auto max-w-2xl px-6 py-16 text-ink/50">Loading…</p>;
  }

  if (status === "not-found") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="font-display text-4xl text-navy-950">Booking not found</h1>
        <Link to="/" className="mt-4 inline-block text-amber-600 hover:underline">
          Back home
        </Link>
      </main>
    );
  }

  const isConfirmed = booking.status === "CONFIRMED";
  const tickets = booking.tickets || [];

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      {isConfirmed ? (
        <>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-600">
            Booking confirmed
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-wide text-navy-950">
            You&rsquo;re in, {booking.guestName.split(" ")[0]}.
          </h1>
          <p className="mt-2 text-ink/60">
            {booking.event?.title} —{" "}
            {booking.event?.startAt
              ? new Date(booking.event.startAt).toLocaleString(undefined, {
                  dateStyle: "full",
                  timeStyle: "short",
                })
              : ""}
          </p>

          {booking.deliveryLog?.length > 0 && (
            <p className="mt-3 text-sm text-ink/50">
              Sent to{" "}
              {booking.deliveryLog
                .map((d) => `${d.to} (${d.channel === "EMAIL" ? "email" : "SMS"})`)
                .join(" and ")}
              .
            </p>
          )}
        </>
      ) : (
        <>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-stub-600">
            {booking.status}
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-wide text-navy-950">
            This booking isn&rsquo;t confirmed
          </h1>
          <p className="mt-2 text-ink/60">
            Its status is <span className="font-mono">{booking.status}</span>. If your
            reservation expired, head back and book again.
          </p>
        </>
      )}

      <div className="stub-divider my-8" />

      {/* Individual QR tickets — one per purchased unit */}
      {isConfirmed && tickets.length > 0 && (
        <div className="mb-8 flex flex-col gap-5">
          {tickets.map((ticket, i) => (
            <div
              key={ticket._id}
              className="overflow-hidden rounded-lg border border-navy-950/10 bg-white"
            >
              <div className="flex items-center justify-between bg-navy-950 px-5 py-3 text-paper">
                <div>
                  <p className="font-display text-lg tracking-wide">{booking.event?.title}</p>
                  <p className="font-mono text-xs text-paper/60">
                    {ticket.tierName} · Ticket {i + 1} of {tickets.length}
                  </p>
                </div>
                <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider text-amber-500">
                  {ticket.status}
                </span>
              </div>

              <div className="flex items-center gap-5 p-5">
                <img
                  src={ticket.qrDataUrl}
                  alt={`QR code for ${ticket.tierName} ticket`}
                  className="h-32 w-32 shrink-0 rounded-md border border-navy-950/10"
                />
                <div>
                  <p className="text-sm text-ink/60">
                    Show this QR code at the door. Each code is valid for one entry.
                  </p>
                  <a
                    href={ticket.qrDataUrl}
                    download={`ticket-${ticket._id}.png`}
                    className="mt-2 inline-block text-sm text-amber-600 hover:underline"
                  >
                    Download
                  </a>
                  <p className="mt-3 text-xs text-ink/40">
                    Testing without a camera? Ticket code:{" "}
                    <code className="rounded bg-paper-dim px-1.5 py-0.5 text-ink/70">
                      {ticket.qrToken}
                    </code>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-navy-950/10 bg-white p-6">
        <h2 className="font-display text-xl tracking-wide text-navy-950">Order summary</h2>
        <div className="mt-4 flex flex-col gap-2">
          {booking.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-ink/70">
                {item.quantity} × {item.tierName}
              </span>
              <span className="font-mono text-ink/80">₹{item.unitPrice * item.quantity}</span>
            </div>
          ))}
        </div>
        <div className="stub-divider my-4" />
        <div className="flex justify-between font-medium">
          <span className="text-navy-950">Total paid</span>
          <span className="font-mono text-navy-950">₹{booking.totalAmount}</span>
        </div>
      </div>

      {!isConfirmed && (
        <p className="mt-8 rounded-md bg-navy-950/5 px-4 py-3 text-sm text-ink/60">
          Save this link — it&rsquo;s your record of this booking.
        </p>
      )}
    </main>
  );
}
