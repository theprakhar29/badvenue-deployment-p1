import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function OrganizerLayout({ children }) {
  const { organizer, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-navy-950/10 bg-navy-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="font-display text-2xl tracking-wide text-paper">
            MARQUEE
          </Link>
          {organizer ? (
            <nav className="flex items-center gap-6">
              <Link to="/organizer/dashboard" className="text-sm text-paper/80 hover:text-amber-500">
                Dashboard
              </Link>
              <span className="text-sm text-paper/50">{organizer.name}</span>
              <button onClick={handleLogout} className="text-sm text-paper/80 hover:text-stub-500">
                Log out
              </button>
            </nav>
          ) : (
            <nav className="flex items-center gap-4">
              <Link to="/organizer/login" className="text-sm text-paper/80 hover:text-amber-500">
                Log in
              </Link>
              <Link
                to="/organizer/signup"
                className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-navy-950 hover:bg-amber-600"
              >
                Sign up
              </Link>
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
