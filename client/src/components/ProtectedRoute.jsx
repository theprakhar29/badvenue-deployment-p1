import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function ProtectedRoute({ children }) {
  const { organizer, loading } = useAuth();

  if (loading) {
    return <div className="mx-auto max-w-6xl px-6 py-10 text-ink/50">Loading…</div>;
  }

  if (!organizer) {
    return <Navigate to="/organizer/login" replace />;
  }

  return children;
}
