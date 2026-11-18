import { useEffect, useState } from 'react'
import { useEvents } from '../hooks.ts'
import { formatEventWhen, publicText, upcomingEvents } from '../lib/format.ts'
import { useApp } from '../state.tsx'

export function ClubScreen() {
  const { demo, now, session, member, operator, openAuth, openProfile, signOut, installPrompt, promptInstall } = useApp()
  const { rows, error, loading, reload } = useEvents()
  const [installed, setInstalled] = useState(false)
  const upcoming = upcomingEvents(rows ?? [], now)
  const next = upcoming[0]
  const when = next ? formatEventWhen(next.date) : null

  useEffect(() => {
    const ios = 'standalone' in navigator && Boolean((navigator as { standalone?: boolean }).standalone)
    setInstalled(window.matchMedia('(display-mode: standalone)').matches || ios)
  }, [])

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <h1>Club night</h1>
          <p className="lede">Cwmbran & District Amateur Radio Society, Gwent.</p>
        </div>
      </header>

      {loading ? <div className="skeleton tall" aria-hidden="true" /> : null}

      {error && !rows ? (
        <div className="error-box" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn-line" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      ) : null}

      {!loading && next && when ? (
        <article className="event-card">
          <p className="kicker">Next up</p>
          <h2>{next.title}</h2>
          <p className="when">{when.date}</p>
          <p className="when time">{when.time}</p>
          {publicText(next.location) ? <p className="place">{publicText(next.location)}</p> : null}
          {publicText(next.description) ? <p>{publicText(next.description)}</p> : null}
        </article>
      ) : null}

      {!loading && !error && !next ? (
        <div className="empty">
          <p>The next club night has not been added yet.</p>
        </div>
      ) : null}

      {upcoming.length > 1 ? (
        <section>
          <h2>Also coming up</h2>
          <ul className="later">
            {upcoming.slice(1, 4).map((event) => {
              const slot = formatEventWhen(event.date)
              return (
                <li key={event.id}>
                  <p className="call">{event.title}</p>
                  <p className="person">
                    {slot.date}, {slot.time}
                  </p>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      <section className="panel">
        <h2>Your details</h2>
        {demo ? (
          <p>
            Demo mode is using <strong>{operator?.callsign}</strong>
            {operator?.displayName ? `, ${operator.displayName}` : ''}. Turn it off to use your own callsign.
          </p>
        ) : null}
        {!demo && member ? (
          <>
            <p className="call">{member.callsign}</p>
            {publicText(member.display_name) ? <p>{publicText(member.display_name)}</p> : null}
            {session?.user.email ? <p className="muted">{session.user.email}</p> : null}
            <button type="button" className="btn btn-line" onClick={openProfile}>
              Edit callsign
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => void signOut()}>
              Sign out
            </button>
          </>
        ) : null}
        {!demo && !member ? (
          <>
            <p>You can look around without an account. Sign in when you want to go on the air or run the net.</p>
            <button type="button" className="btn btn-primary" onClick={() => openAuth()}>
              Sign in
            </button>
          </>
        ) : null}
      </section>

      <section className="panel">
        <h2>Add to your home screen</h2>
        {installed ? (
          <p>CADARS Live is already on this phone.</p>
        ) : installPrompt ? (
          <>
            <p>Keep the on-air list one tap away.</p>
            <button type="button" className="btn btn-primary" onClick={() => void promptInstall()}>
              Add CADARS Live
            </button>
          </>
        ) : (
          <ol className="steps">
            <li>On iPhone, tap Share, then Add to Home Screen.</li>
            <li>On Android, open the browser menu and choose Install app, or Add to Home screen.</li>
          </ol>
        )}
      </section>
    </div>
  )
}
