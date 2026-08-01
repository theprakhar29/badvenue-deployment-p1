import { useState } from "react";
import { useNavigate } from "react-router-dom";
import OrganizerLayout from "../../components/OrganizerLayout.jsx";
import Field from "../../components/Field.jsx";
import Button from "../../components/Button.jsx";
import { api } from "../../api/client.js";

const emptyTier = () => ({ name: "", price: "", totalQty: "" });

export default function NewEvent() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    venueName: "",
    city: "",
    startAt: "",
    capacity: "",
    description: "",
  });
  const [tiers, setTiers] = useState([emptyTier()]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  function updateTier(index, patch) {
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const event = await api.post("/events", {
        ...form,
        capacity: form.capacity || undefined,
        pricingTiers: tiers.map((t) => ({
          name: t.name,
          price: t.price,
          totalQty: t.totalQty,
        })),
      });
      navigate(`/organizer/events/${event._id}/form`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <OrganizerLayout>
      <div className="mx-auto max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-600">
          Step 1 of 3 — Event basics
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-wide text-navy-950">
          Tell us about your show
        </h1>
        <p className="mt-2 text-sm text-ink/60">
          Saved as a draft — you&rsquo;ll build your ticket form and publish in the next
          steps.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-8">
          <section className="flex flex-col gap-4 rounded-lg border border-navy-950/10 bg-white p-6">
            <Field
              label="Event title"
              name="title"
              required
              placeholder="Friday Night Comedy Open Mic"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Venue name"
                name="venueName"
                placeholder="The Backyard"
                value={form.venueName}
                onChange={(e) => setForm({ ...form, venueName: e.target.value })}
              />
              <Field
                label="City"
                name="city"
                placeholder="Delhi"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Date & time"
                name="startAt"
                type="datetime-local"
                required
                value={form.startAt}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
              />
              <Field
                label="Capacity"
                name="capacity"
                type="number"
                min={1}
                placeholder="100"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="description" className="text-sm font-medium text-ink/80">
                Description
              </label>
              <textarea
                id="description"
                rows={3}
                className="rounded-md border border-navy-950/15 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink/40 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                placeholder="What should people expect?"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </section>

          <section className="rounded-lg border border-navy-950/10 bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl tracking-wide text-navy-950">
                Pricing tiers
              </h2>
              <button
                type="button"
                onClick={() => setTiers((prev) => [...prev, emptyTier()])}
                className="text-sm font-medium text-amber-600 hover:underline"
              >
                + Add tier
              </button>
            </div>
            <div className="stub-divider my-4" />

            <div className="flex flex-col gap-4">
              {tiers.map((tier, i) => (
                <div key={i} className="grid grid-cols-[2fr_1fr_1fr_auto] items-end gap-3">
                  <Field
                    label="Tier name"
                    name={`tier-name-${i}`}
                    required
                    placeholder="General"
                    value={tier.name}
                    onChange={(e) => updateTier(i, { name: e.target.value })}
                  />
                  <Field
                    label="Price (₹)"
                    name={`tier-price-${i}`}
                    type="number"
                    min={0}
                    required
                    value={tier.price}
                    onChange={(e) => updateTier(i, { price: e.target.value })}
                  />
                  <Field
                    label="Quantity"
                    name={`tier-qty-${i}`}
                    type="number"
                    min={1}
                    required
                    value={tier.totalQty}
                    onChange={(e) => updateTier(i, { totalQty: e.target.value })}
                  />
                  {tiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setTiers((prev) => prev.filter((_, idx) => idx !== i))}
                      className="mb-2.5 text-sm text-stub-500 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {error && (
            <p className="rounded-md bg-stub-500/10 px-3 py-2 text-sm text-stub-600">{error}</p>
          )}

          <div className="flex justify-end gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving draft…" : "Save draft & continue"}
            </Button>
          </div>
        </form>
      </div>
    </OrganizerLayout>
  );
}
