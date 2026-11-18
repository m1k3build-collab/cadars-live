import { useState, type FormEvent } from 'react'
import { useDirectory, useOnAir, useRepeaters, useScrollLock } from '../hooks.ts'
import { demoClearOnAir, demoGoOnAir } from '../lib/demo.ts'
import {
  activeOnAir,
  formatFrequency,
  friendlyMessage,
  mhzString,
  publicText,
  pulse,
  sortOnAir,
  stationCount,
  timeLeft,
} from '../lib/format.ts'
import { clearOnAir, goOnAir } from '../lib/live.ts'
import { useApp } from '../state.tsx'
import type { OnAirRow } from '../types.ts'

const SIMPLEX = '145.500'

export function OnAirScreen() {
  const {
    demo,
    now,
    operator,
    session,
    authReady,
    member,
    memberLoading,
    toast,
    openAuth,
    openProfile,
  } = useApp()
  const { rows, error, loading, status, reload } = useOnAir()
  const { rows: repeaters } = useRepeaters()
  const names = useDirectory()
  const [customOpen, setCustomOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  useScrollLock(customOpen)

  const gb3ya = mhzString(repeaters?.find((item) => item.callsign === 'GB3YA')?.output, '145.7125')
  const stations = sortOnAir(activeOnAir(rows ?? [], now), operator?.callsign ?? null)
  const mine = operator ? stations.find((item) => item.callsign === operator.callsign) : undefined
  const presence = demo ? 'Sample' : status === 'SUBSCRIBED' ? 'Live' : error ? 'Offline' : 'Connecting'

  async function transmit(frequency: string, note: string | null) {
    if (demo) {
      demoGoOnAir(frequency, note)
      pulse()
      toast(`You are on ${formatFrequency(frequency)}.`)
      setCustomOpen(false)
      return
    }
    if (!authReady || memberLoading) {
      toast('One moment while we check your sign-in.')
      return
    }
    if (!session) {
      openAuth('Sign in to put yourself on the air. We will email you a code.')
      return
    }
    if (!member) {
      openProfile()
      return
    }
    setBusy(frequency)
    try {
      await goOnAir(member.callsign, frequency, note)
      pulse()
      toast(`You are on ${formatFrequency(frequency)}.`)
      setCustomOpen(false)
      await reload()
    } catch (err) {
      toast(friendlyMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function clear() {
    if (demo) {
      demoClearOnAir()
      pulse()
      toast('You are off the list.')
      return
    }
    if (!member) return
    setBusy('clear')
    try {
      await clearOnAir(member.callsign)
      pulse()
      toast('You are off the list.')
      await reload()
    } catch (err) {
      toast(friendlyMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <h1>Who's on the air</h1>
          <p className="lede">
            {demo ? 'You are MW0CAD. A tap only changes this phone.' : 'A tap lasts an hour, then it drops off.'}
          </p>
        </div>
        <span className={`presence ${presence === 'Live' ? 'live' : presence === 'Sample' ? 'sample' : 'wait'}`}>
          {presence}
        </span>
      </header>

      {mine ? <YouCard row={mine} now={now} busy={busy === 'clear'} onClear={() => void clear()} /> : null}

      <div className="actions">
        <button
          type="button"
          className="btn btn-primary stack-btn"
          disabled={Boolean(busy)}
          onClick={() => void transmit(gb3ya, 'GB3YA')}
        >
          <span className="btn-title">{busy === gb3ya ? 'Putting you on…' : "I'm on GB3YA"}</span>
          <span className="btn-sub">{formatFrequency(gb3ya)} · Cwmbran repeater</span>
        </button>
        <button
          type="button"
          className="btn btn-line stack-btn"
          disabled={Boolean(busy)}
          onClick={() => void transmit(SIMPLEX, 'Simplex')}
        >
          <span className="btn-title">{busy === SIMPLEX ? 'Putting you on…' : '145.500 simplex'}</span>
          <span className="btn-sub">Radio to radio, no repeater</span>
        </button>
        <button type="button" className="btn btn-quiet stack-btn" disabled={Boolean(busy)} onClick={() => setCustomOpen(true)}>
          <span className="btn-title">Other frequency</span>
          <span className="btn-sub">Type the one you are using</span>
        </button>
      </div>

      <p className="count" aria-live="polite">
        {loading ? 'Checking the band…' : stationCount(stations.length)}
      </p>

      {loading ? (
        <div className="stack" aria-hidden="true">
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton short" />
        </div>
      ) : null}

      {error && !rows ? (
        <div className="error-box" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn-line" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      ) : null}

      {error && rows ? <p className="inline-error">{error}</p> : null}

      {!loading && !error && stations.length === 0 ? (
        <div className="empty">
          <div className="quiet-meter" aria-hidden="true">
            <i /><i /><i /><i /><i />
          </div>
          <p>The band is quiet just now.</p>
          <p className="muted">When you put out a call, the club can see your frequency here.</p>
        </div>
      ) : null}

      <ul className="station-list">
        {stations.map((row) => (
          <StationCard
            key={row.id}
            row={row}
            now={now}
            you={row.callsign === operator?.callsign}
            name={publicText(names.get(row.callsign)?.display_name ?? null)}
          />
        ))}
      </ul>

      {customOpen ? (
        <CustomSheet
          busy={Boolean(busy)}
          onClose={() => setCustomOpen(false)}
          onSubmit={(frequency, note) => void transmit(frequency, note)}
        />
      ) : null}
    </div>
  )
}

function YouCard({ row, now, busy, onClear }: { row: OnAirRow; now: number; busy: boolean; onClear: () => void }) {
  const left = timeLeft(row.expires_at, now)
  const note = publicText(row.note)
  return (
    <section className="you-card">
      <p className="kicker">You are on the air</p>
      <p className="freq">{formatFrequency(row.frequency)}</p>
      {note ? <p className="pill">{note}</p> : null}
      <p className="timeleft">{left?.label ?? 'Dropping off'}</p>
      <button type="button" className="btn btn-danger" disabled={busy} onClick={onClear}>
        {busy ? 'Clearing…' : 'Clear my status'}
      </button>
    </section>
  )
}

function StationCard({
  row,
  now,
  you,
  name,
}: {
  row: OnAirRow
  now: number
  you: boolean
  name: string | null
}) {
  const left = timeLeft(row.expires_at, now)
  const note = publicText(row.note)
  if (!left) return null
  return (
    <li className={you ? 'station you' : 'station'}>
      <div className="row">
        <p className="call">
          {row.callsign}
          {you ? <span className="you-tag">You</span> : null}
        </p>
        <p className={left.minutes <= 10 ? 'timeleft low' : 'timeleft'}>{left.label}</p>
      </div>
      {name ? <p className="person">{name}</p> : null}
      <p className="freq">{formatFrequency(row.frequency)}</p>
      {note ? <p className="pill">{note}</p> : null}
      <div
        className={left.minutes <= 10 ? 'meter-track low' : 'meter-track'}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={60}
        aria-valuenow={Math.min(60, left.minutes)}
        aria-label={`${left.label} for ${row.callsign}`}
      >
        <span style={{ width: `${left.fraction * 100}%` }} />
      </div>
    </li>
  )
}

function CustomSheet({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean
  onClose: () => void
  onSubmit: (frequency: string, note: string | null) => void
}) {
  const [frequency, setFrequency] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const value = frequency.trim()
    if (!/\d/.test(value) || value.length < 3 || value.length > 24) {
      setError('Enter a frequency, for example 145.550.')
      return
    }
    const cleanNote = publicText(note)?.slice(0, 80) ?? null
    onSubmit(value, cleanNote)
  }

  return (
    <div className="sheet-wrap">
      <button type="button" className="backdrop" aria-label="Close" onClick={onClose} />
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby="freq-title" onSubmit={submit}>
        <div className="grabber" aria-hidden="true" />
        <h2 id="freq-title">Other frequency</h2>
        <p className="muted">This replaces your current status and lasts an hour.</p>
        <label className="field-label" htmlFor="frequency">
          Frequency
        </label>
        <input
          id="frequency"
          className="field"
          inputMode="decimal"
          autoComplete="off"
          placeholder="145.550"
          value={frequency}
          onChange={(event) => setFrequency(event.target.value)}
          autoFocus
        />
        <label className="field-label" htmlFor="air-note">
          Note, optional
        </label>
        <input
          id="air-note"
          className="field"
          maxLength={80}
          placeholder="Calling CQ"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Putting you on…' : 'Put me on the air'}
        </button>
      </form>
    </div>
  )
}
