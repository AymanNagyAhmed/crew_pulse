import { useEffect, useState } from 'react'
import './App.css'

const apiBase = (
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3000'
).replace(/\/$/, '')

type GatewayHealth = 'checking' | 'ok' | 'down'

type HealthEnvelope = {
  success?: boolean
  data?: { status?: string }
}

function App() {
  const [gateway, setGateway] = useState<GatewayHealth>('checking')

  useEffect(() => {
    const controller = new AbortController()

    void (async () => {
      try {
        const res = await fetch(`${apiBase}/v1/health`, {
          signal: controller.signal,
        })
        if (!res.ok) {
          setGateway('down')
          return
        }
        const body = (await res.json()) as HealthEnvelope
        setGateway(
          body.success === true && body.data?.status === 'ok' ? 'ok' : 'down',
        )
      } catch {
        if (!controller.signal.aborted) {
          setGateway('down')
        }
      }
    })()

    return () => controller.abort()
  }, [])

  const statusLabel =
    gateway === 'checking'
      ? 'Checking api-gateway…'
      : gateway === 'ok'
        ? 'api-gateway reachable'
        : 'api-gateway unreachable — run make up'

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
        <div className="home__cta-group">
          <a className="home__cta" href={`${apiBase}/v1/health`}>
            Open API health
            <span className="home__cta-mark" aria-hidden="true">
              →
            </span>
          </a>
          <p
            className={`home__status home__status--${gateway}`}
            role="status"
            aria-live="polite"
          >
            {statusLabel}
          </p>
        </div>
      </div>
    </main>
  )
}

export default App
