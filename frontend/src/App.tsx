// App.tsx
// Main application router — defines all page routes

import { BrowserRouter, Routes, Route } from 'react-router-dom'

// existing pages
import Home from "./pages/Landing/Home";
import Login from "./pages/Login/Login";

// NEW PAGES ADDED BY MARITZA — 06/25/2026
import ListTools from "./pages/Tools/ListTools";
import BrowseTools from "./pages/Tools/BrowseTools";
import InviteOnly from "./pages/Invite/InviteOnly";

// global styles
import './style.css'

function App() {

  return (
    <BrowserRouter>
      <Routes>

        {/* existing routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />

        {/* NEW ROUTES ADDED BY MARITZA — 06/25/2026 */}
        <Route path="/tools" element={<ListTools />} />         {/* List Your Tools page */}
        <Route path="/browse" element={<BrowseTools />} />      {/* Browse & Reserve page */}
        <Route path="/invite" element={<InviteOnly />} />       {/* Invite Only page */}

      </Routes>
    </BrowserRouter>
  )
}

export default App
