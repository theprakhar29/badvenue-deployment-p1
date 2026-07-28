import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

import Home from "./pages/Home.jsx";
import EventDetail from "./pages/EventDetail.jsx";
import BookingConfirmation from "./pages/BookingConfirmation.jsx";
import Signup from "./pages/organizer/Signup.jsx";
import Login from "./pages/organizer/Login.jsx";
import Dashboard from "./pages/organizer/Dashboard.jsx";
import NewEvent from "./pages/organizer/NewEvent.jsx";
import FormBuilder from "./pages/organizer/FormBuilder.jsx";
import ScannerLinks from "./pages/organizer/ScannerLinks.jsx";
import OrganizerScan from "./pages/organizer/OrganizerScan.jsx";
import ScanTerminal from "./pages/ScanTerminal.jsx";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/events/:slug" element={<EventDetail />} />
        <Route path="/bookings/:id" element={<BookingConfirmation />} />
        <Route path="/organizer/signup" element={<Signup />} />
        <Route path="/organizer/login" element={<Login />} />
        <Route
          path="/organizer/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizer/events/new"
          element={
            <ProtectedRoute>
              <NewEvent />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizer/events/:id/form"
          element={
            <ProtectedRoute>
              <FormBuilder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizer/events/:id/scanners"
          element={
            <ProtectedRoute>
              <ScannerLinks />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizer/events/:id/scan"
          element={
            <ProtectedRoute>
              <OrganizerScan />
            </ProtectedRoute>
          }
        />
        <Route path="/scan/:token" element={<ScanTerminal />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}

function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-24 text-center">
      <h1 className="font-display text-5xl text-navy-950">Page not found</h1>
    </div>
  );
}
