// App.tsx
// Main application router — defines all page routes

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from "./pages/Landing/Home";
import Login from "./pages/Login/Login";
import Dashboard from "./pages/Dashboard/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";

// NEW PAGES ADDED BY MARITZA — 07/02/2026
import SendInvite from "./pages/Invite/SendInvite";
import Register from "./pages/Register/Register";

function App() {

  return (
    <BrowserRouter>
      <Routes>

        {/* Public routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />

        {/* NEW — Public route: anyone with an invite link can register */}
        <Route path="/register" element={<Register />} />

        {/* Protected routes — must be logged in */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />

          {/* NEW — Protected route: only logged-in users can send invites */}
          <Route path="/invite" element={<SendInvite />} />
        </Route>

      </Routes>
    </BrowserRouter>
  )
}

export default App