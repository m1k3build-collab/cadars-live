import { useEffect, useState, type FormEvent } from 'react'
import { ApprovalNote } from '../components/ApprovalNote.tsx'
import { useDirectory, useNets } from '../hooks.ts'
import { demoCheckIn, demoCloseTonight, demoStartNet } from '../lib/demo.ts'
import {
  attendanceTally,
  awardCallsigns,
  errorCode,
  formatClock,
  friendlyMessage,
  londonParts,
  nightsLabel,
  prepareCallsign,
  publicText,
  pulse,
  tonightsNet,
} from '../lib/format.ts'
import { checkIn, startNet } from '../lib/live.ts'
import { useApp } from '../state.tsx'

const REPORTS = ['5/9', '5/8', '5/7', '5/5', '4/3']

export function NetScreen() {
  const { demo, now, member, toast, requireWriter } = useApp()
  const { nets, error, loading, status, reload } = useNets()
  const names = useDirectory()
  const [typed, setTyped] = useState('')
  const [selected, setSelected] = useState<string | null>('5/9')
  const [customReport, setCustomReport] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  const today = londonParts(new Date(now)).isoDate
  const year = londonParts(new Date(now)).year
  const monday = londonParts(new Date(now)).weekdayIndex === 1
  const bundles = nets ?? []
  const tonight = tonightsNet(bundles, today)
  const tally = attendanceTally(bundles.flatMap((net) => net.checkins))
  const awards = awardCallsigns(tally)
  const checked = new Set(tonight?.checkins.map((item) => item.callsign) ?? [])
  const presence = demo ? 'Sample' : status === 'SUBSCRIBED' ? 'Live' : error ? 'Offline' : 'Connecting'
  const report = publicText(customReport)?.slice(0, 16) ?? selected

  useEffect(() => {
    if (!flash) return
    document.getElementById(`checkin-${flash}`)?.scrollIntoView({ block: 'nearest' })
    const timer = window.setTimeout(() => setFlash(null), 1600)
    return () => window.clearTimeout(timer)
  }, [flash])

  async function openTonight() {
    if (!requireWriter('run the net')) return
    setBusy(true)
    try {
      if (demo) demoStartNet(today)
      else if (member) {
        await startNet(today, member.callsign)
        await reload()
      } else return
      pulse()
      toast("Tonight's net is open.")
    } catch (err) {
      toast(friendlyMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function add(raw: string) {
    const parsed = prepareCallsign(raw)
    if (!parsed.ok) {
      setFormError(parsed.message)
      return
    }
    if (!tonight) {
      setFormError("Open tonight's net first.")
      return
    }
    if (checked.has(parsed.callsign)) {
      toast(`${parsed.callsign} is already on the list.`)
      return
    }
    if (!requireWriter('check a station in')) return
    setBusy(true)
    try {
      if (demo) demoCheckIn(tonight.id, parsed.callsign, report)
      else {
        await checkIn(tonight.id, parsed.callsign, report)
        await reload()
      }
      pulse()
      setFlash(parsed.callsign)
      setTyped('')
      setFormError(null)
      toast(`${parsed.callsign} is checked in.`)
    } catch (err) {
      if (errorCode(err) === '23505') toast(`${parsed.callsign} is already on the list.`)
      else toast(friendlyMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function submitTyped(event: FormEvent) {
    event.preventDefault()
    void add(typed)
  }

  const controller = tonight?.controller_callsign
  const controllerName = controller ? publicText(names.get(controller)?.display_name ?? null) : null

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <h1>Monday net</h1>
          <p className="lede">
            {monday ? 'Check people in as they call on GB3YA.' : 'Usually a Monday. You can still run tonight on GB3YA.'}
          </p>
        </div>
        <span className={`presence ${presence === 'Live' ? 'live' : presence === 'Sample' ? 'sample' : 'wait'}`}>
          {presence}
        </span>
      </header>
      <ApprovalNote />

      {loading ? (
        <div className="stack" aria-hidden="true">
          <div className="skeleton" />
          <div className="skeleton short" />
        </div>
      ) : null}

      {error && !nets ? (
        <div className="error-box" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn-line" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      ) : null}

      {!loading && !tonight ? (
        <section className="panel">
          <p className="kicker">Not open yet</p>
          <p>Nobody has started a net for tonight.</p>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void openTonight()}>
            {busy ? 'Opening…' : "Start tonight's net"}
          </button>
        </section>
      ) : null}

      {tonight ? (
        <section className="panel">
          <p className="kicker">Tonight on {tonight.repeater}</p>
          <p>
            {controller
              ? `Controlled by ${controller}${controllerName ? `, ${controllerName}` : ''}.`
              : 'Controller not set.'}
          </p>
        </section>
      ) : null}

      {tonight ? (
        <div className="stack">
          <div>
            <p className="field-label" id="report-label">
              Signal report, optional
            </p>
            <div className="signal-row" role="group" aria-labelledby="report-label">
              {REPORTS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={selected === item && !customReport.trim() ? 'chip on' : 'chip'}
                  aria-pressed={selected === item && !customReport.trim()}
                  onClick={() => {
                    setCustomReport('')
                    setSelected((current) => (current === item ? null : item))
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
            <p className="hint">Tap a report, then a callsign. It stays selected.</p>
          </div>

          {tally.length > 0 ? (
            <div>
              <p className="field-label">Regulars</p>
              <div className="regulars">
                {tally.slice(0, 10).map((row) => {
                  const done = checked.has(row.callsign)
                  return (
                    <button
                      key={row.callsign}
                      type="button"
                      className={done ? 'chip done' : 'chip call-chip'}
                      aria-label={done ? `${row.callsign} already checked in` : `Check in ${row.callsign}`}
                      onClick={() => void add(row.callsign)}
                    >
                      {row.callsign}
                      {done ? <span className="tick">In</span> : null}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <p className="muted">Regulars show up here after a few nets.</p>
          )}

          <section>
            <h2>Checked in</h2>
            {tonight.checkins.length === 0 ? (
              <p className="muted">No one yet. Tap a regular, or type a callsign.</p>
            ) : (
              <ul className="checkin-list">
                {tonight.checkins.map((item) => {
                  const name = publicText(names.get(item.callsign)?.display_name ?? null)
                  return (
                    <li
                      key={item.id}
                      id={`checkin-${item.callsign}`}
                      className={flash === item.callsign ? 'checkin flash' : 'checkin'}
                    >
                      <div>
                        <p className="call">{item.callsign}</p>
                        {name ? <p className="person">{name}</p> : null}
                      </div>
                      <div className="checkin-meta">
                        <p className="report">{item.signal_report ? publicText(item.signal_report) : 'No report'}</p>
                        <p className="when">{formatClock(item.created_at)}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <form className="stack" onSubmit={submitTyped}>
            <label className="field-label" htmlFor="checkin-call">
              Or type a callsign
            </label>
            <input
              id="checkin-call"
              className="field callsign"
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="go"
              placeholder="Callsign"
              value={typed}
              onChange={(event) => setTyped(event.target.value.toUpperCase())}
            />
            <label className="field-label" htmlFor="custom-report">
              Other report
            </label>
            <input
              id="custom-report"
              className="field"
              maxLength={16}
              placeholder="For example 59 plus"
              value={customReport}
              onChange={(event) => setCustomReport(event.target.value)}
            />
            {formError ? <p className="form-error">{formError}</p> : null}
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Checking in…' : 'Check in'}
            </button>
          </form>
        </div>
      ) : null}

      <section className="tally">
        <h2>Attendance in {year}</h2>
        <p className="hint">Three or more nights, and the most regular, earns a badge.</p>
        {tally.length === 0 ? <p className="muted">No check-ins recorded this year yet.</p> : null}
        <ol className="tally-list">
          {tally.slice(0, 8).map((row) => {
            const name = publicText(names.get(row.callsign)?.display_name ?? null)
            const width = Math.max(8, Math.round((row.nights / (tally[0]?.nights || 1)) * 100))
            return (
              <li key={row.callsign}>
                <div className="row">
                  <p className="call">
                    {row.callsign}
                    {awards.has(row.callsign) ? <span className="award">Most regular</span> : null}
                  </p>
                  <p className="nights">{nightsLabel(row.nights)}</p>
                </div>
                {name ? <p className="person">{name}</p> : null}
                <div className="bar" aria-hidden="true">
                  <span style={{ width: `${width}%` }} />
                </div>
              </li>
            )
          })}
        </ol>
        {demo && tonight ? (
          <button
            type="button"
            className="text-btn"
            onClick={() => {
              demoCloseTonight(today)
              toast('Sample net closed. You can start a fresh one.')
            }}
          >
            Close the sample net
          </button>
        ) : null}
      </section>
    </div>
  )
}
