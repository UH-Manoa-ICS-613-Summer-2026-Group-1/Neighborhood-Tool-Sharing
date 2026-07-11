import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from "./pages/Landing/Home";
import Login from "./pages/Login/Login";
import Dashboard from "./pages/Dashboard/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import SendInvite from "./pages/Invite/SendInvite";
import Register from "./pages/Register/Register";
import UploadTest from "./components/UploadTest"; // Please delete when implement the upload feature

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
          <Route path="/test-upload" element={<UploadTest />} /> // Please delete when implement the upload feature
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
