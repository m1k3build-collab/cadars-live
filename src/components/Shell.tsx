import { useEffect, useState, type FormEvent } from 'react'
import { useScrollLock } from '../hooks.ts'
import { friendlyMessage, isDisplayName, prepareCallsign, publicText } from '../lib/format.ts'
import { sendEmailCode, verifyEmailCode } from '../lib/live.ts'
import { ClubScreen } from '../screens/Club.tsx'
import { NetScreen } from '../screens/Net.tsx'
import { OnAirScreen } from '../screens/OnAir.tsx'
import { RepeatersScreen } from '../screens/Repeaters.tsx'
import { useApp } from '../state.tsx'
import type { Tab } from '../types.ts'

const TABS: { id: Tab; label: string }[] = [
  { id: 'air', label: 'On air' },
  { id: 'net', label: 'Net' },
  { id: 'repeaters', label: 'Repeaters' },
  { id: 'club', label: 'Club' },
]

export function Shell() {
  const app = useApp()
  return (
    <div className="app-frame">
      <a className="skip" href="#content">
        Skip to content
      </a>
      <header className="topbar">
        <button type="button" className="brand" onClick={() => app.setTab('air')}>
          <span className="meter" aria-hidden="true">
            <i /><i /><i /><i /><i />
          </span>
          <span className="wordmark">
            <strong>CADARS</strong>
            <em>Live</em>
          </span>
        </button>
        <div className="top-actions">
          <button
            type="button"
            className="icon-btn"
            aria-label={app.theme === 'dark' ? 'Switch to light colours' : 'Switch to dark colours'}
            onClick={app.toggleTheme}
          >
            {app.theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={app.demo || app.session ? 'Your details' : 'Sign in'}
            onClick={() => {
              if (app.demo || app.session) app.setTab('club')
              else app.openAuth()
            }}
          >
            <PersonIcon />
          </button>
        </div>
      </header>
      <div className={app.demo ? 'demo-bar on' : 'demo-bar'}>
        <p className="demo-copy">
          <strong>Demo mode</strong>
          <span>
            {app.demo
              ? 'Sample stations on this phone. Nothing is saved. You are MW0CAD.'
              : 'Sample stations for club night. Nothing is saved.'}
          </span>
        </p>
        <button type="button" aria-pressed={app.demo} onClick={() => app.setDemo(!app.demo)}>
          {app.demo ? 'Turn off' : 'Turn on'}
        </button>
      </div>
      <main id="content" className="content">
        {app.tab === 'air' ? <OnAirScreen /> : null}
        {app.tab === 'net' ? <NetScreen /> : null}
        {app.tab === 'repeaters' ? <RepeatersScreen /> : null}
        {app.tab === 'club' ? <ClubScreen /> : null}
      </main>
      <nav className="tabbar" aria-label="Sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className="tab"
            aria-current={app.tab === tab.id ? 'page' : undefined}
            onClick={() => app.setTab(tab.id)}
          >
            <TabIcon id={tab.id} />
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="toasts" role="status" aria-live="polite">
        {app.toasts.map((item) => (
          <p key={item.id} className="toast">
            {item.message}
          </p>
        ))}
      </div>
      <AuthSheet />
      <ProfileSheet />
    </div>
  )
}

function AuthSheet() {
  const { authOpen, authReason, closeAuth, toast } = useApp()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useScrollLock(authOpen)

  useEffect(() => {
    if (!authOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAuth()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [authOpen, closeAuth])

  async function send(event: FormEvent) {
    event.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter the email address you want the code sent to.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await sendEmailCode(email)
      setSent(true)
      toast('Check your email for a code, or tap the link on this phone.')
    } catch (err) {
      setError(friendlyMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault()
    if (!/^\d{6,10}$/.test(code.trim())) {
      setError('Enter the code from the email.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await verifyEmailCode(email, code)
      toast('You are signed in.')
      setCode('')
      setSent(false)
    } catch (err) {
      setError(friendlyMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!authOpen) return null
  return (
    <div className="sheet-wrap">
      <button type="button" className="backdrop" aria-label="Close" onClick={closeAuth} />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <div className="grabber" aria-hidden="true" />
        <h2 id="auth-title">Sign in</h2>
        <p>{authReason}</p>
        {sent ? (
          <form className="stack" onSubmit={(event) => void verify(event)}>
            <label className="field-label" htmlFor="code">
              Code from the email
            </label>
            <input
              id="code"
              className="field code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoFocus
            />
            {error ? <p className="form-error">{error}</p> : null}
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Checking…' : 'Sign in with this code'}
            </button>
            <button type="button" className="text-btn" onClick={() => setSent(false)}>
              Use a different email
            </button>
          </form>
        ) : (
          <form className="stack" onSubmit={(event) => void send(event)}>
            <label className="field-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="field"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoFocus
            />
            {error ? <p className="form-error">{error}</p> : null}
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Sending…' : 'Email me a code'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function ProfileSheet() {
  const { profileOpen, closeProfile, member, saveProfile } = useApp()
  const [callsign, setCallsign] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useScrollLock(profileOpen)

  useEffect(() => {
    if (!profileOpen) return
    setCallsign(member?.callsign ?? '')
    setName(member?.display_name ?? '')
    setError(null)
  }, [profileOpen, member])

  useEffect(() => {
    if (!profileOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeProfile()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [profileOpen, closeProfile])

  async function save(event: FormEvent) {
    event.preventDefault()
    const parsed = prepareCallsign(callsign)
    if (!parsed.ok) {
      setError(parsed.message)
      return
    }
    if (!isDisplayName(name)) {
      setError('Tell us what to call you. Letters only, no phone numbers.')
      return
    }
    const clean = publicText(name)
    if (!clean) {
      setError('Tell us what to call you.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await saveProfile(parsed.callsign, clean)
    } catch (err) {
      setError(friendlyMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!profileOpen) return null
  return (
    <div className="sheet-wrap">
      <button type="button" className="backdrop" aria-label="Close" onClick={closeProfile} />
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby="profile-title" onSubmit={(event) => void save(event)}>
        <div className="grabber" aria-hidden="true" />
        <h2 id="profile-title">{member ? 'Edit your callsign' : 'Your callsign'}</h2>
        <p>We need this once, before you can go on the air or check people in.</p>
        <label className="field-label" htmlFor="my-call">
          Callsign
        </label>
        <input
          id="my-call"
          className="field callsign"
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          value={callsign}
          onChange={(event) => setCallsign(event.target.value.toUpperCase())}
          autoFocus
        />
        <label className="field-label" htmlFor="my-name">
          What should we call you?
        </label>
        <input
          id="my-name"
          className="field"
          autoComplete="given-name"
          maxLength={40}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save my callsign'}
        </button>
      </form>
    </div>
  )
}

function TabIcon({ id }: { id: Tab }) {
  if (id === 'air') return <AirIcon />
  if (id === 'net') return <NetIcon />
  if (id === 'repeaters') return <TowerIcon />
  return <CalIcon />
}

function AirIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 19h16M7 19V13M12 19V7M17 19v-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function NetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 7h11M8 12h11M8 17h7M5 7h.01M5 12h.01M5 17h.01" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function TowerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21V9M8 21l4-12 4 12M5 7a8 8 0 0114 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CalIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 3v4M16 3v4M4 10h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M5.5 19.5c1.4-3 3.6-4.5 6.5-4.5s5.1 1.5 6.5 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 3.5A8.5 8.5 0 1 0 20.5 15 7 7 0 0 1 16 3.5Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}
