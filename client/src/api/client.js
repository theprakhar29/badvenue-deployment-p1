// In local dev, VITE_API_URL is left unset and requests go to the relative
// "/api" path, which Vite's dev proxy (vite.config.js) forwards to
// localhost:4000 — no config needed.
//
// In production (Vercel frontend + Render backend, or any split deploy),
// there's no dev proxy, so a relative "/api" path resolves against the
// FRONTEND's own domain and silently hits nothing. VITE_API_URL must be set
// at build time (Vercel project settings -> Environment Variables) to the
// deployed backend's full URL, e.g. https://your-backend.onrender.com/api.
const API_BASE = import.meta.env.VITE_API_URL || "/api";

// The bare backend origin (no /api suffix), used to resolve relative asset
// paths the server returns — e.g. bannerUrl: "/uploads/banners/x.jpg" is
// relative to the BACKEND, not the frontend, so it needs the same treatment
// as API calls once they're on different domains.
const ASSET_ORIGIN = API_BASE === "/api" ? "" : API_BASE.replace(/\/api\/?$/, "");

export function resolveAssetUrl(path) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path; // already absolute
  return `${ASSET_ORIGIN}${path}`;
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = data?.error?.message || "Something went wrong. Please try again.";
    throw new Error(message);
  }

  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) }),
  async upload(path, formData) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      credentials: "include",
      body: formData, // browser sets multipart Content-Type + boundary automatically
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error?.message || "Upload failed.");
    }
    return data;
  },
};
