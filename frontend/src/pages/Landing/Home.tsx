import { useNavigate } from 'react-router-dom'
import './Home.css'

const Home = () => {
    const navigate = useNavigate()

    return (
        <main className="home">
            <div className="home-top">
                <h1 className="home-title">Neighborhood Tool Sharing</h1>
            </div>

            <div className="home-cards">
                <div className="home-card">
                    <span className="home-card-icon">🔧</span>
                    <h3>List Your Tools</h3>
                    <p>Share your tools with photos, condition notes, and lending rules.</p>
                </div>
                <div className="home-card">
                    <span className="home-card-icon">📅</span>
                    <h3>Reserve with Ease</h3>
                    <p>Browse available tools and request a reservation for your time window.</p>
                </div>
                <div className="home-card">
                    <span className="home-card-icon">🏘️</span>
                    <h3>Invite Only</h3>
                    <p>A trusted, private community. Join only with a valid invite from a neighbor.</p>
                </div>
            </div>

            <div className="home-bottom">
                <button type="button" className="login-btn" onClick={() => navigate('/login')}>
                    Sign In
                </button>
            </div>
        </main>
    )
}

export default Home