import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, resolveAssetUrl } from "../api/client.js";
import { loadRazorpayScript } from "../utils/razorpay.js";
import Field from "../components/Field.jsx";
import Button from "../components/Button.jsx";

const FIELD_LABELS = {
  PHONE: "Phone number",
  AGE: "Age",
};

export default function EventDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ok | not-found

  const [quantities, setQuantities] = useState({}); // { tierId: qty }
  const [guest, setGuest] = useState({ guestName: "", guestEmail: "", guestPhone: "" });
  const [customAnswers, setCustomAnswers] = useState({}); // { PHONE: "", AGE: "", CUSTOM_QUESTION: "" }
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  function loadEvent() {
    api
      .get(`/public/events/${slug}`)
      .then((data) => {
        setEvent(data);
        setStatus("ok");
      })
      .catch(() => setStatus("not-found"));
  }

  function setQty(tierId, qty) {
    setQuantities((prev) => ({ ...prev, [tierId]: Math.max(0, qty) }));
  }

  const selectedItems = event
    ? event.pricingTiers
        .map((tier) => ({ tier, qty: quantities[tier._id] || 0 }))
        .filter((x) => x.qty > 0)
    : [];

  const totalAmount = selectedItems.reduce((sum, x) => sum + x.tier.price * x.qty, 0);

  async function handleCheckout(e) {
    e.preventDefault();
    setError(null);

    if (selectedItems.length === 0) {
      setError("Select at least one ticket.");
      return;
    }

    setSubmitting(true);
    try {
      const formResponses = Object.entries(customAnswers)
        .filter(([, value]) => value && value.trim())
        .map(([fieldKey, value]) => ({ fieldKey, value }));

      // Step 1: create the booking (reserves inventory).
      const booking = await api.post(`/public/events/${slug}/bookings`, {
        guestName: guest.guestName,
        guestEmail: guest.guestEmail,
        guestPhone: guest.guestPhone,
        items: selectedItems.map((x) => ({ pricingTierId: x.tier._id, quantity: x.qty })),
        formResponses,
      });

      // Step 2: ask the server to start a payment for this booking. The
      // server decides mock vs. real Razorpay based on whether keys are
      // configured — the client just reacts to what it gets back.
      const order = await api.post(`/public/bookings/${booking._id}/payment-order`, {});

      if (order.mock) {
        // No gateway configured at all — confirm directly, same as before.
        await api.post(`/public/bookings/${booking._id}/confirm`, {});
        navigate(`/bookings/${booking._id}`);
        return;
      }

      // Step 3: open Razorpay Checkout for a real payment.
      await loadRazorpayScript();

      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          order_id: order.orderId,
          name: "Marquee",
          description: event.title,
          prefill: {
            name: guest.guestName,
            email: guest.guestEmail || undefined,
            contact: guest.guestPhone || undefined,
          },
          theme: { color: "#F5A623" }, // amber-500, matches the app's accent
          handler: async (response) => {
            try {
              // Step 4: hand the payment proof back to the server, which
              // verifies it cryptographically before confirming anything.
              await api.post(`/public/bookings/${booking._id}/confirm`, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          modal: {
            ondismiss: () => {
              // User closed the payment modal without paying. The booking
              // stays PENDING and its hold will expire on its own — nothing
              // to clean up here.
              reject(new Error("Payment was cancelled."));
            },
          },
        });

        rzp.on("payment.failed", (response) => {
          reject(new Error(response.error?.description || "Payment failed. Please try again."));
        });

        rzp.open();
      });

      navigate(`/bookings/${booking._id}`);
    } catch (err) {
      setError(err.message);
      // Availability may have changed (e.g. sold out mid-checkout) - refresh it.
      loadEvent();
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return <p className="mx-auto max-w-3xl px-6 py-16 text-ink/50">Loading…</p>;
  }

  if (status === "not-found") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="font-display text-4xl text-navy-950">Show not found</h1>
        <p className="mt-2 text-ink/60">
          It may have been unpublished, or the link is incorrect.
        </p>
      </main>
    );
  }

  const enabledFields = event.formFields.filter((f) => f.enabled);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      {event.bannerUrl && (
        <img src={resolveAssetUrl(event.bannerUrl)} alt="" className="mb-8 h-64 w-full rounded-lg object-cover" />
      )}
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-600">
        {event.city ?? "Location TBA"}
      </p>
      <h1 className="mt-2 font-display text-5xl tracking-wide text-navy-950">{event.title}</h1>
      <p className="mt-3 text-ink/70">
        {event.startAt
          ? new Date(event.startAt).toLocaleString(undefined, {
              dateStyle: "full",
              timeStyle: "short",
            })
          : "Date TBA"}
        {event.venueName ? ` · ${event.venueName}` : ""}
      </p>

      {event.description && <p className="mt-6 max-w-xl text-ink/80">{event.description}</p>}

      <div className="stub-divider my-10" />

      <form onSubmit={handleCheckout}>
        <h2 className="font-display text-2xl tracking-wide text-navy-950">Select tickets</h2>
        <div className="mt-4 flex flex-col gap-3">
          {event.pricingTiers.map((tier) => {
            const available = tier.totalQty - tier.soldQty - tier.reservedQty;
            const qty = quantities[tier._id] || 0;
            return (
              <div
                key={tier._id}
                className="flex items-center justify-between rounded-lg border border-navy-950/10 bg-white px-5 py-4"
              >
                <div>
                  <p className="font-medium text-navy-950">{tier.name}</p>
                  <p className="font-mono text-sm text-ink/50">
                    {available > 0 ? `${available} left` : "Sold out"}
                  </p>
                  <p className="font-mono text-lg text-navy-950">₹{tier.price}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={qty === 0}
                    onClick={() => setQty(tier._id, qty - 1)}
                    className="h-8 w-8 rounded-full border border-navy-950/20 text-navy-950 disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-mono">{qty}</span>
                  <button
                    type="button"
                    disabled={qty >= available}
                    onClick={() => setQty(tier._id, qty + 1)}
                    className="h-8 w-8 rounded-full border border-navy-950/20 text-navy-950 disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {selectedItems.length > 0 && (
          <>
            <div className="stub-divider my-10" />

            <h2 className="font-display text-2xl tracking-wide text-navy-950">Your details</h2>
            <div className="mt-4 flex flex-col gap-4 rounded-lg border border-navy-950/10 bg-white p-6">
              <Field
                label="Full name"
                name="guestName"
                required
                value={guest.guestName}
                onChange={(e) => setGuest({ ...guest, guestName: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Email"
                  name="guestEmail"
                  type="email"
                  placeholder="you@example.com"
                  value={guest.guestEmail}
                  onChange={(e) => setGuest({ ...guest, guestEmail: e.target.value })}
                />
                <Field
                  label="Phone"
                  name="guestPhoneContact"
                  placeholder="For ticket delivery"
                  value={guest.guestPhone}
                  onChange={(e) => setGuest({ ...guest, guestPhone: e.target.value })}
                />
              </div>
              <p className="text-xs text-ink/40">
                We&rsquo;ll send your ticket here — no account needed. Provide at least one.
              </p>

              {enabledFields.map((field) => (
                <Field
                  key={field.key}
                  label={
                    field.key === "CUSTOM_QUESTION"
                      ? field.label || "Additional info"
                      : `${FIELD_LABELS[field.key]}${field.required ? "" : " (optional)"}`
                  }
                  name={`field-${field.key}`}
                  required={field.required}
                  type={field.key === "AGE" ? "number" : "text"}
                  value={customAnswers[field.key] || ""}
                  onChange={(e) =>
                    setCustomAnswers({ ...customAnswers, [field.key]: e.target.value })
                  }
                />
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between rounded-lg bg-navy-950 px-6 py-5 text-paper">
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-paper/60">
                  Total
                </p>
                <p className="font-display text-3xl tracking-wide">₹{totalAmount}</p>
              </div>
              <Button type="submit" disabled={submitting} className="px-8 py-3 text-base">
                {submitting ? "Processing…" : `Book & pay ₹${totalAmount}`}
              </Button>
            </div>
            <p className="mt-2 text-center text-xs text-ink/40">
              Secured by Razorpay. Card, UPI, and netbanking accepted.
            </p>
          </>
        )}

        {error && (
          <p className="mt-4 rounded-md bg-stub-500/10 px-3 py-2 text-sm text-stub-600">{error}</p>
        )}
      </form>
    </main>
  );
}
