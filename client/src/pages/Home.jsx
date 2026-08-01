import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, resolveAssetUrl } from "../api/client.js";
import Button from "../components/Button.jsx";

export default function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/public/events")
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main>
      <section className="relative overflow-hidden bg-navy-950 bg-marquee-glow px-6 py-24 text-paper">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-amber-500">
            Now Booking
          </p>
          <h1 className="font-display text-6xl tracking-wide text-paper sm:text-8xl">
            Your show. <br className="hidden sm:block" />
            One link to sell it out.
          </h1>
          <p className="mx-auto mt-6 max-w-xl font-body text-base text-paper/70">
            Create an event, build your ticket form, and hand your door team a
            scanner that works even when the venue Wi-Fi doesn&rsquo;t.
          </p>
          <div className="mt-10 flex justify-center gap-3">
            <Link to="/organizer/signup">
              <Button variant="primary" className="px-7 py-3 text-base">
                Start selling tickets
              </Button>
            </Link>
            <Link to="/organizer/login">
              <Button
                variant="ghost"
                className="border-paper/30 px-7 py-3 text-base text-paper hover:bg-paper/10"
              >
                Organizer login
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="font-display text-3xl tracking-wide text-navy-950">Shows near you</h2>
        <div className="stub-divider my-6" />

        {loading ? (
          <p className="text-ink/50">Loading shows…</p>
        ) : events.length === 0 ? (
          <div className="rounded-lg border border-dashed border-navy-950/20 bg-white px-6 py-16 text-center">
            <p className="font-body text-ink/60">
              No shows published yet. Once an organizer publishes an event, it&rsquo;ll
              show up here.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => {
              const fromPrice = event.pricingTiers?.length
                ? Math.min(...event.pricingTiers.map((t) => t.price))
                : null;
              return (
                <Link
                  key={event._id}
                  to={`/events/${event.slug}`}
                  className="group overflow-hidden rounded-lg border border-navy-950/10 bg-white transition-shadow hover:shadow-lg"
                >
                  {event.bannerUrl && (
                    <img
                      src={resolveAssetUrl(event.bannerUrl)}
                      alt=""
                      className="h-36 w-full object-cover"
                    />
                  )}
                  <div className="p-5">
                  <p className="font-mono text-xs uppercase tracking-wider text-amber-600">
                    {event.city ?? "Location TBA"}
                  </p>
                  <h3 className="mt-2 font-display text-2xl tracking-wide text-navy-950 group-hover:text-amber-600">
                    {event.title}
                  </h3>
                  <p className="mt-1 text-sm text-ink/60">
                    {event.startAt
                      ? new Date(event.startAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "Date TBA"}
                  </p>
                  {fromPrice !== null && (
                    <p className="mt-4 font-mono text-sm text-ink/80">from ₹{fromPrice}</p>
                  )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
