import { Component, type ReactNode } from 'react'
import { Shell } from './components/Shell.tsx'
import { AppProvider } from './state.tsx'

class Guard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="crash">
          <h1>CADARS Live hit a snag</h1>
          <p>Reload the page. Demo mode will be ready again if you need it at club night.</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export function App() {
  return (
    <Guard>
      <AppProvider>
        <Shell />
      </AppProvider>
    </Guard>
  )
}
