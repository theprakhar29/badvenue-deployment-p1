import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import OrganizerLayout from "../../components/OrganizerLayout.jsx";
import Button from "../../components/Button.jsx";
import Field from "../../components/Field.jsx";
import Toggle from "../../components/Toggle.jsx";
import { api, resolveAssetUrl } from "../../api/client.js";

const FIELD_META = {
  PHONE: { title: "Phone number", hint: "Collect a phone number at checkout." },
  AGE: { title: "Age", hint: "Ask attendees their age." },
  CUSTOM_QUESTION: { title: "Custom question", hint: "Ask anything you want, in your own words." },
};

export default function FormBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [event, setEvent] = useState(null);
  const [formFields, setFormFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);

  useEffect(() => {
    api
      .get(`/events/${id}`)
      .then((data) => {
        setEvent(data);
        setFormFields(data.formFields);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  function updateField(key, patch) {
    setFormFields((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  async function handleBannerChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBannerPreview(URL.createObjectURL(file));
    setUploading(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append("banner", file);
      const updated = await api.upload(`/events/${id}/banner`, fd);
      setEvent(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveAndContinue() {
    setSaving(true);
    setError(null);
    try {
      await api.put(`/events/${id}/form-fields`, { formFields });
      navigate("/organizer/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <OrganizerLayout>
        <p className="text-ink/50">Loading…</p>
      </OrganizerLayout>
    );
  }

  if (!event) {
    return (
      <OrganizerLayout>
        <p className="text-stub-600">Couldn&rsquo;t load this event. {error}</p>
        <Link to="/organizer/dashboard" className="mt-4 inline-block text-amber-600 hover:underline">
          Back to dashboard
        </Link>
      </OrganizerLayout>
    );
  }

  const bannerSrc = bannerPreview || resolveAssetUrl(event.bannerUrl);

  return (
    <OrganizerLayout>
      <div className="mx-auto max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-600">
          Step 2 of 3 — Form &amp; ticket builder
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-wide text-navy-950">
          Design your ticket &amp; checkout form
        </h1>
        <p className="mt-2 text-sm text-ink/60">
          For <span className="font-medium text-navy-950">{event.title}</span>. Choose what
          you want to ask attendees, and give the show a banner image.
        </p>

        {/* Banner upload */}
        <section className="mt-8 rounded-lg border border-navy-950/10 bg-white p-6">
          <h2 className="font-display text-2xl tracking-wide text-navy-950">Ticket banner</h2>
          <p className="mt-1 text-sm text-ink/60">
            Shown on your public event page and on the generated ticket template.
          </p>
          <div className="stub-divider my-4" />

          <div className="flex items-center gap-5">
            <div className="flex h-28 w-48 items-center justify-center overflow-hidden rounded-md bg-paper-dim">
              {bannerSrc ? (
                <img src={bannerSrc} alt="Event banner" className="h-full w-full object-cover" />
              ) : (
                <span className="px-2 text-center text-xs text-ink/40">No banner uploaded yet</span>
              )}
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleBannerChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="ghost"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? "Uploading…" : bannerSrc ? "Replace image" : "Upload image"}
              </Button>
              <p className="mt-2 text-xs text-ink/40">JPEG, PNG, or WEBP · up to 5MB</p>
            </div>
          </div>
        </section>

        {/* Preset form fields */}
        <section className="mt-6 rounded-lg border border-navy-950/10 bg-white p-6">
          <h2 className="font-display text-2xl tracking-wide text-navy-950">
            Checkout questions
          </h2>
          <p className="mt-1 text-sm text-ink/60">
            Every ticket already collects a name and contact info. Turn on anything
            extra you need.
          </p>
          <div className="stub-divider my-4" />

          <div className="flex flex-col divide-y divide-navy-950/10">
            {formFields.map((field) => (
              <div key={field.key} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-navy-950">{FIELD_META[field.key].title}</p>
                    <p className="text-sm text-ink/50">{FIELD_META[field.key].hint}</p>
                  </div>
                  <Toggle
                    checked={field.enabled}
                    onChange={(val) => updateField(field.key, { enabled: val })}
                  />
                </div>

                {field.enabled && field.key === "CUSTOM_QUESTION" && (
                  <Field
                    label="Question text"
                    name="custom-question-label"
                    placeholder="e.g. What size T-shirt do you wear?"
                    value={field.label}
                    onChange={(e) => updateField(field.key, { label: e.target.value })}
                  />
                )}

                {field.enabled && (
                  <label className="flex w-fit items-center gap-2 text-sm text-ink/60">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => updateField(field.key, { required: e.target.checked })}
                      className="rounded border-navy-950/30 text-amber-500 focus:ring-amber-500"
                    />
                    Required
                  </label>
                )}
              </div>
            ))}
          </div>
        </section>

        {error && (
          <p className="mt-6 rounded-md bg-stub-500/10 px-3 py-2 text-sm text-stub-600">{error}</p>
        )}

        <div className="mt-8 flex justify-between">
          <Link to="/organizer/dashboard">
            <Button variant="ghost">Back to dashboard</Button>
          </Link>
          <Button onClick={handleSaveAndContinue} disabled={saving}>
            {saving ? "Saving…" : "Save & continue"}
          </Button>
        </div>
      </div>
    </OrganizerLayout>
  );
}
