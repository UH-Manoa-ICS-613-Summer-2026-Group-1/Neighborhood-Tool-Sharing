// App.tsx
// Main application router — defines all page routes

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from "./pages/Landing/Home";
import Login from "./pages/Login/Login";
import Dashboard from "./pages/Dashboard/Dashboard";


// global styles
// import './style.css'

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
