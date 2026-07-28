import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import OrganizerLayout from "../../components/OrganizerLayout.jsx";
import Button from "../../components/Button.jsx";
import Field from "../../components/Field.jsx";
import { api } from "../../api/client.js";

const STATUS_STYLES = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  REVOKED: "bg-stub-500/10 text-stub-600",
  EXPIRED: "bg-navy-950/10 text-ink/50",
};

export default function ScannerLinks() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [links, setLinks] = useState([]);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  function load() {
    setLoading(true);
    Promise.all([api.get(`/events/${id}`), api.get(`/events/${id}/scanner-links`)])
      .then(([eventData, linksData]) => {
        setEvent(eventData);
        setLinks(linksData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await api.post(`/events/${id}/scanner-links`, { label });
      setLabel("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(linkId) {
    if (!confirm("Revoke this scanner link? Anyone currently using it will be locked out immediately.")) {
      return;
    }
    try {
      await api.patch(`/events/${id}/scanner-links/${linkId}/revoke`, {});
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function linkUrl(token) {
    return `${window.location.origin}/scan/${token}`;
  }

  async function handleCopy(token, linkId) {
    await navigator.clipboard.writeText(linkUrl(token));
    setCopiedId(linkId);
    setTimeout(() => setCopiedId(null), 1500);
  }

  if (loading) {
    return (
      <OrganizerLayout>
        <p className="text-ink/50">Loading…</p>
      </OrganizerLayout>
    );
  }

  return (
    <OrganizerLayout>
      <div className="mx-auto max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-600">
          Team access
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-wide text-navy-950">
          Scanner links
        </h1>
        <p className="mt-2 text-sm text-ink/60">
          For <span className="font-medium text-navy-950">{event?.title}</span>. Anyone
          with a link can scan entry — no account needed on their end. Revoke a link
          anytime to lock them out instantly.
        </p>

        <div className="mt-6 flex items-center justify-between rounded-lg border border-navy-950/10 bg-white p-4">
          <div>
            <p className="text-sm font-medium text-navy-950">Scan tickets yourself</p>
            <p className="text-xs text-ink/50">No link needed — you're already logged in.</p>
          </div>
          <Link to={`/organizer/events/${id}/scan`}>
            <Button variant="ghost" className="text-sm">Open scanner</Button>
          </Link>
        </div>

        <form
          onSubmit={handleCreate}
          className="mt-6 flex items-end gap-3 rounded-lg border border-navy-950/10 bg-white p-6"
        >
          <div className="flex-1">
            <Field
              label="Label (optional)"
              name="label"
              placeholder="e.g. Front Gate, Priya's phone"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={creating}>
            {creating ? "Creating…" : "+ New link"}
          </Button>
        </form>

        {error && (
          <p className="mt-4 rounded-md bg-stub-500/10 px-3 py-2 text-sm text-stub-600">{error}</p>
        )}

        <div className="mt-8 flex flex-col gap-3">
          {links.length === 0 ? (
            <p className="text-sm text-ink/50">No scanner links yet.</p>
          ) : (
            links.map((link) => (
              <div
                key={link._id}
                className="rounded-lg border border-navy-950/10 bg-white p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-navy-950">
                      {link.label || "Unnamed link"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider ${STATUS_STYLES[link.status]}`}
                    >
                      {link.status}
                    </span>
                  </div>
                  {link.status === "ACTIVE" && (
                    <button
                      onClick={() => handleRevoke(link._id)}
                      className="text-sm text-stub-600 hover:underline"
                    >
                      Revoke
                    </button>
                  )}
                </div>

                {link.status === "ACTIVE" && (
                  <div className="mt-3 flex items-center gap-2">
                    <code className="flex-1 truncate rounded bg-paper-dim px-2 py-1.5 text-xs text-ink/70">
                      {linkUrl(link.token)}
                    </code>
                    <button
                      onClick={() => handleCopy(link.token, link._id)}
                      className="shrink-0 rounded-md border border-navy-950/15 px-3 py-1.5 text-xs text-navy-950 hover:bg-navy-950/5"
                    >
                      {copiedId === link._id ? "Copied!" : "Copy"}
                    </button>
                  </div>
                )}

                <p className="mt-2 text-xs text-ink/40">
                  Created {new Date(link.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  {link.lastSeenAt &&
                    ` · Last used ${new Date(link.lastSeenAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`}
                </p>
              </div>
            ))
          )}
        </div>

        <Link to="/organizer/dashboard" className="mt-8 inline-block text-sm text-amber-600 hover:underline">
          Back to dashboard
        </Link>
      </div>
    </OrganizerLayout>
  );
}
