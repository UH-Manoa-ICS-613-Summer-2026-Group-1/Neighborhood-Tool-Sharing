// App.tsx
// Main application router — defines all page routes
// Protected routes require a valid JWT token (handled by ProtectedRoute)

import { BrowserRouter, Routes, Route } from 'react-router'

// Public pages
import Home from "./pages/Landing/Home";
import Login from "./pages/Login/Login";
import Register from "./pages/Register/Register";
// ADDED BY MARITZA — Calendar page covering US 26 Scenario 3
import CalendarPage from "./pages/Calendar/CalendarPage";

// Protected pages — existing
import Dashboard from "./pages/Dashboard/Dashboard";
import AddTool from "./pages/Tools/AddTool";
import ToolDetail from "./pages/Tools/ToolDetail";
import Profile from "./pages/Profile/Profile";
import SendInvite from "./pages/Invite/SendInvite";
// ADDED BY MARITZA — 07/19/2026
// New reservation pages covering US 2 (request) and US 3-5, 7, 9, 10 (transactions)
import RequestReservation from "./pages/Reservations/RequestReservation";
// Review page, both parties review a RETURNED reservation
import MakeReview from "./pages/Reservations/MakeReview";
// Route guard — redirects unauthenticated users to /login
import ProtectedRoute from "./components/ProtectedRoute";


function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Public routes — accessible without logging in */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes — must be logged in */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/invite" element={<SendInvite />} />
          <Route path="/tools/new" element={<AddTool />} />
          <Route path="/tools/:toolId" element={<ToolDetail />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/reservations/:reservationId/review" element={<MakeReview />} />

          {/* ADDED BY MARITZA — 07/19/2026
              US 2: Borrower requests a reservation for a specific tool
              Reached by clicking "Request Reservation" on the Tool Detail page */}
          <Route path="/tools/:toolId/reserve" element={<RequestReservation />} />
        </Route>

      </Routes>
    </BrowserRouter>
  )
}

export default App
