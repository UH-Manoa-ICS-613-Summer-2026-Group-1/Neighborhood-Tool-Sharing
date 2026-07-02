import Navbar from '../../components/Navbar'

// Landing page for authenticated users, rendered at "/dashboard"
// (only reachable when ProtectedRoute confirms a valid access token).
export default function Dashboard() {
  return (
    <div>
      <Navbar />
    </div>
  )
}