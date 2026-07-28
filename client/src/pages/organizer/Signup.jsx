import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Field from "../../components/Field.jsx";
import Button from "../../components/Button.jsx";
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";

export default function Signup() {
  const navigate = useNavigate();
  const { setOrganizer } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const organizer = await api.post("/auth/signup", form);
      setOrganizer(organizer);
      navigate("/organizer/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-4xl tracking-wide text-navy-950">
        Set up your organizer account
      </h1>
      <p className="mt-2 text-sm text-ink/60">
        Minimum info required — you can add payout and branding details later.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <Field
          label="Your name"
          name="name"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          required
          minLength={8}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />

        {error && (
          <p className="rounded-md bg-stub-500/10 px-3 py-2 text-sm text-stub-600">{error}</p>
        )}

        <Button type="submit" disabled={loading} className="mt-2 w-full">
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink/60">
        Already have an account?{" "}
        <Link to="/organizer/login" className="text-amber-600 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
