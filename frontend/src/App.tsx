import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from "./pages/Landing/Home";
import Login from "./pages/Login/Login";
import Dashboard from "./pages/Dashboard/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import SendInvite from "./pages/Invite/SendInvite";
import Register from "./pages/Register/Register";
import AddTool from "./pages/Tools/AddTool";
import ToolDetail from "./pages/Tools/ToolDetail";
import Profile from "./pages/Profile/Profile";

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/invite" element={<SendInvite />} />
          <Route path="/tools/new" element={<AddTool />} />
          <Route path="/tools/:toolId" element={<ToolDetail />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
