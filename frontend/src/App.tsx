import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from "./pages/Landing/Home";
import Login from "./pages/Login/Login";
import Dashboard from "./pages/Dashboard/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          {/* add more protected pages here, e.g. */}
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
