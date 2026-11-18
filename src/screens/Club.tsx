import { useEffect, useState, type FormEvent } from 'react'
import { ApprovalNote } from '../components/ApprovalNote.tsx'
import { useEvents, useMembers, useScrollLock } from '../hooks.ts'
import { demoDeleteEvent, demoSaveEvent } from '../lib/demo.ts'
import {
  downloadIcs,
  formatEventWhen,
  friendlyMessage,
  londonDateAndTime,
  nextWednesdayEvening,
  pastEvents,
  publicText,
  roleLabel,
  upcomingEvents,
  zonedTimeToIso,
} from '../lib/format.ts'
import { deleteEvent, saveEvent } from '../lib/live.ts'
import { useApp } from '../state.tsx'
import type { ClubEvent } from '../types.ts'

export function ClubScreen() {
  const {
    demo,
    now,
    session,
    member,
    operator,
    committee,
    toast,
    openAuth,
    openProfile,
    signOut,
    installPrompt,
    promptInstall,
    setTab,
    requireCommittee,
  } = useApp()
  const { rows, error, loading, reload } = useEvents()
  const members = useMembers()
  const [installed, setInstalled] = useState(false)
  const [editing, setEditing] = useState<ClubEvent | 'new' | null>(null)
  const events = rows ?? []
  const upcoming = upcomingEvents(events, now)
  const past = pastEvents(events, now)
  const pending = (members.rows ?? []).filter((row) => row.status === 'pending').length

  useEffect(() => {
    const ios = 'standalone' in navigator && Boolean((navigator as { standalone?: boolean }).standalone)
    setInstalled(window.matchMedia('(display-mode: standalone)').matches || ios)
  }, [])

  function openEditor(event: ClubEvent | 'new') {
    if (!requireCommittee('change the diary')) return
    setEditing(event)
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <h1>Club diary</h1>
          <p className="lede">Wednesdays 7–9pm at Henllys Village Hall. The GB3YA net is Monday evening.</p>
        </div>
      </header>
      <ApprovalNote />

      {committee ? (
        <button type="button" className="btn btn-line" onClick={() => openEditor('new')}>
          Add an event
        </button>
      ) : null}

      {loading ? <div className="skeleton tall" aria-hidden="true" /> : null}

      {error && !rows ? (
        <div className="error-box" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn-line" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      ) : null}

      {!loading && upcoming.length === 0 && !error ? (
        <div className="empty">
          <p>Nothing coming up yet.</p>
        </div>
      ) : null}

      {upcoming.map((event, index) => (
        <EventCard
          key={event.id}
          event={event}
          kicker={index === 0 ? 'Next up' : undefined}
          committee={committee}
          onEdit={() => openEditor(event)}
        />
      ))}

      {past.length > 0 ? (
        <details className="past">
          <summary>Earlier ({past.length})</summary>
          <div className="stack">
            {past.map((event) => (
              <EventCard key={event.id} event={event} committee={committee} onEdit={() => openEditor(event)} />
            ))}
          </div>
        </details>
      ) : null}

      {committee ? (
        <button type="button" className="btn btn-quiet" onClick={() => setTab('members')}>
          Review new members{pending > 0 ? ` (${pending})` : ''}
        </button>
      ) : null}

      <section className="panel">
        <h2>Your details</h2>
        {demo ? (
          <p>
            Demo mode is using <strong>{operator?.callsign}</strong>
            {operator?.displayName ? `, ${operator.displayName}` : ''}. In the sample you can add events and approve
            members. Turn it off to use your own callsign.
          </p>
        ) : null}
        {!demo && member ? (
          <>
            <p className="call">{member.callsign}</p>
            {publicText(member.display_name) ? <p>{publicText(member.display_name)}</p> : null}
            <p className="muted">
              {member.status === 'approved'
                ? roleLabel(member.role)
                : member.status === 'rejected'
                  ? 'Not approved'
                  : 'Waiting for approval'}
            </p>
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
            <p>You can look around without an account. Sign in when you want a callsign on the list.</p>
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

      {editing ? (
        <EventSheet
          event={editing === 'new' ? null : editing}
          busyLabel={editing === 'new' ? 'Add event' : 'Save changes'}
          onClose={() => setEditing(null)}
          onSaved={async (input) => {
            if (demo) demoSaveEvent(input)
            else {
              await saveEvent(input)
              await reload()
            }
            toast(input.id ? 'Event updated.' : 'Event added.')
            setEditing(null)
          }}
          onDelete={
            editing === 'new'
              ? undefined
              : async (id) => {
                  if (demo) demoDeleteEvent(id)
                  else {
                    await deleteEvent(id)
                    await reload()
                  }
                  toast('Event deleted.')
                  setEditing(null)
                }
          }
        />
      ) : null}
    </div>
  )
}

function EventCard({
  event,
  kicker,
  committee,
  onEdit,
}: {
  event: ClubEvent
  kicker?: string
  committee: boolean
  onEdit: () => void
}) {
  const when = formatEventWhen(event.date)
  const place = publicText(event.location)
  const about = publicText(event.description)
  return (
    <article className="event-card">
      {kicker ? <p className="kicker">{kicker}</p> : null}
      <h2>{event.title}</h2>
      <p className="when">{when.date}</p>
      <p className="when time">{when.time}</p>
      {place ? <p className="place">{place}</p> : null}
      {about ? <p>{about}</p> : null}
      <div className="pair">
        <button type="button" className="btn btn-quiet" onClick={() => downloadIcs(event)}>
          Add to calendar
        </button>
        {committee ? (
          <button type="button" className="btn btn-line" onClick={onEdit}>
            Edit
          </button>
        ) : null}
      </div>
    </article>
  )
}

function EventSheet({
  event,
  busyLabel,
  onClose,
  onSaved,
  onDelete,
}: {
  event: ClubEvent | null
  busyLabel: string
  onClose: () => void
  onSaved: (input: {
    id?: string
    title: string
    date: string
    location: string | null
    description: string | null
  }) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}) {
  const initial = event ? londonDateAndTime(event.date) : londonDateAndTime(nextWednesdayEvening())
  const [title, setTitle] = useState(event?.title ?? '')
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(event ? initial.time : '19:00')
  const [location, setLocation] = useState(event?.location ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  useScrollLock(true)

  async function save(formEvent: FormEvent) {
    formEvent.preventDefault()
    const cleanTitle = publicText(title)?.slice(0, 80) ?? ''
    if (!cleanTitle) {
      setError('Give the event a name.')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Choose a date.')
      return
    }
    const match = /^(\d{2}):(\d{2})$/.exec(time)
    if (!match) {
      setError('Choose a start time.')
      return
    }
    const hour = Number(match[1])
    const minute = Number(match[2])
    if (hour > 23 || minute > 59) {
      setError('Choose a start time.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSaved({
        id: event?.id,
        title: cleanTitle,
        date: zonedTimeToIso(date, hour, minute),
        location: publicText(location)?.slice(0, 80) ?? null,
        description: publicText(description)?.slice(0, 280) ?? null,
      })
    } catch (err) {
      setError(friendlyMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="sheet-wrap">
      <button type="button" className="backdrop" aria-label="Close" onClick={onClose} />
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby="event-title" onSubmit={(formEvent) => void save(formEvent)}>
        <div className="grabber" aria-hidden="true" />
        <h2 id="event-title">{event ? 'Edit event' : 'Add an event'}</h2>
        <p className="muted">Club nights run 7–9pm. A saved event is two hours on the calendar.</p>
        <label className="field-label" htmlFor="event-name">
          Name
        </label>
        <input
          id="event-name"
          className="field"
          maxLength={80}
          value={title}
          placeholder="CADARS club night"
          onChange={(input) => setTitle(input.target.value)}
          autoFocus
        />
        <label className="field-label" htmlFor="event-date">
          Date
        </label>
        <input id="event-date" className="field" type="date" value={date} onChange={(input) => setDate(input.target.value)} />
        <label className="field-label" htmlFor="event-time">
          Start time
        </label>
        <input id="event-time" className="field" type="time" value={time} onChange={(input) => setTime(input.target.value)} />
        <label className="field-label" htmlFor="event-place">
          Place
        </label>
        <input
          id="event-place"
          className="field"
          maxLength={80}
          value={location}
          placeholder="Henllys Village Hall"
          onChange={(input) => setLocation(input.target.value)}
        />
        <label className="field-label" htmlFor="event-about">
          Details
        </label>
        <textarea
          id="event-about"
          className="field area"
          maxLength={280}
          value={description}
          placeholder="Weekly club night, 7–9pm."
          onChange={(input) => setDescription(input.target.value)}
        />
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : busyLabel}
        </button>
        {event && onDelete ? (
          <button
            type="button"
            className="btn btn-danger"
            disabled={busy}
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true)
                return
              }
              setBusy(true)
              void onDelete(event.id).catch((err: unknown) => {
                setError(friendlyMessage(err))
                setBusy(false)
                setConfirmDelete(false)
              })
            }}
          >
            {confirmDelete ? 'Delete it' : 'Delete this event'}
          </button>
        ) : null}
      </form>
    </div>
  )
}
