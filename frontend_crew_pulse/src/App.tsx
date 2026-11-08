import './App.css'

const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3000'

function App() {
  return (
    <main className="home">
      <div className="home__visual" aria-hidden="true" />
      <div className="home__content">
        <p className="home__brand">CrewPulse</p>
        <h1 className="home__headline">Contactless crew check-in for live venues</h1>
        <p className="home__lede">
          Face match at the door, shift-aware attendance, and audit-ready logs —
          without slowing service.
        </p>
        <a className="home__cta" href={`${apiBase}/v1/health`}>
          Open API health
          <span className="home__cta-mark" aria-hidden="true">
            →
          </span>
        </a>
      </div>
    </main>
  )
}

export default App
