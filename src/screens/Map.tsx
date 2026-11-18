import L from 'leaflet'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import 'leaflet/dist/leaflet.css'
import { ApprovalNote } from '../components/ApprovalNote.tsx'
import { useCoverage, useDirectory, useRepeaters, useScrollLock } from '../hooks.ts'
import { demoAddCoverage } from '../lib/demo.ts'
import { friendlyMessage, publicText, roundCoord, sortRepeaters } from '../lib/format.ts'
import { addCoverageReport } from '../lib/live.ts'
import { MAP_HOME, repeaterColour, repeaterSites } from '../lib/sites.ts'
import { useApp } from '../state.tsx'
import type { CoverageReport, Repeater } from '../types.ts'

const SIGNALS = ['Full quieting', '5/9', '5/7', '5/5', '4/3', 'Weak']

export function MapScreen() {
  const { demo, member, toast, requireWriter } = useApp()
  const { rows, error, loading, reload } = useCoverage()
  const { rows: repeaters } = useRepeaters()
  const names = useDirectory()
  const [filter, setFilter] = useState('all')
  const [placing, setPlacing] = useState(false)
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [locating, setLocating] = useState(false)
  const [busy, setBusy] = useState(false)

  const list = useMemo(() => sortRepeaters(repeaters ?? []), [repeaters])
  const reports = useMemo(
    () => (rows ?? []).filter((item) => filter === 'all' || item.repeater === filter),
    [rows, filter],
  )
  const colours = useMemo(() => {
    const callsigns = list.map((item) => item.callsign)
    return new Map(list.map((item) => [item.callsign, repeaterColour(item.callsign, callsigns)]))
  }, [list])

  function begin() {
    if (!requireWriter('add a coverage report')) return
    setPlacing(true)
    setSheetOpen(false)
  }

  function usePhone() {
    if (!navigator.geolocation) {
      toast('This phone cannot share its location. Tap the map instead.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const spot = { lat: roundCoord(position.coords.latitude), lng: roundCoord(position.coords.longitude) }
        setDraft(spot)
        setLocating(false)
        toast('Location set, rounded to about 100 metres.')
      },
      () => {
        setLocating(false)
        toast('No location from this phone. Tap the map instead.')
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    )
  }

  async function save(repeater: string, signal: string) {
    if (!draft) {
      toast('Tap the map, or use your location, first.')
      return
    }
    if (!requireWriter('add a coverage report')) return
    setBusy(true)
    try {
      if (demo) demoAddCoverage(draft.lat, draft.lng, repeater, signal)
      else if (member) {
        await addCoverageReport({
          callsign: member.callsign,
          lat: draft.lat,
          lng: draft.lng,
          repeater,
          signal,
        })
        await reload()
      }
      toast(`Report saved for ${repeater}.`)
      setDraft(null)
      setPlacing(false)
      setSheetOpen(false)
    } catch (err) {
      toast(friendlyMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <h1>Coverage</h1>
          <p className="lede">Where members could hear a repeater, around Cwmbran and Newport.</p>
        </div>
        <span className={demo ? 'presence sample' : 'presence live'}>{demo ? 'Sample' : 'Live'}</span>
      </header>
      <ApprovalNote />
      <p className="hint" id="map-help">
        Rings are repeater sites. Dots are reports, saved to about 100 metres so they are not an exact spot.
      </p>
      <div className="signal-row" role="group" aria-label="Filter by repeater">
        <FilterChip label="All" on={filter === 'all'} colour={null} onClick={() => setFilter('all')} />
        {list.map((item) => (
          <FilterChip
            key={item.id}
            label={item.callsign}
            colour={colours.get(item.callsign) ?? '#8a3d00'}
            on={filter === item.callsign}
            onClick={() => setFilter(item.callsign)}
          />
        ))}
      </div>
      {loading ? <div className="skeleton tall" aria-hidden="true" /> : null}
      {error && !rows ? (
        <div className="error-box" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn-line" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      ) : null}
      {!loading ? (
        <CoverageMap
          reports={reports}
          repeaters={list}
          filter={filter}
          colours={colours}
          names={names}
          draft={draft}
          placing={placing}
          onPick={(lat, lng) => setDraft({ lat: roundCoord(lat), lng: roundCoord(lng) })}
        />
      ) : null}
      {placing ? (
        <div className="stack">
          <button type="button" className="btn btn-line" disabled={locating} onClick={usePhone}>
            {locating ? 'Finding you…' : 'Use my location'}
          </button>
          <button type="button" className="btn btn-primary" disabled={!draft} onClick={() => setSheetOpen(true)}>
            {draft ? `Save ${draft.lat.toFixed(3)}, ${draft.lng.toFixed(3)}` : 'Tap the map to choose a spot'}
          </button>
          <button
            type="button"
            className="text-btn"
            onClick={() => {
              setPlacing(false)
              setDraft(null)
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-primary" onClick={begin}>
          Add a coverage report
        </button>
      )}
      <section>
        <h2>{filter === 'all' ? 'Reports' : filter}</h2>
        {reports.length === 0 ? <p className="muted">No reports for this repeater yet.</p> : null}
        <ul className="station-list">
          {reports.map((item) => {
            const name = publicText(names.get(item.callsign)?.display_name ?? null)
            return (
              <li key={item.id} className="station">
                <div className="row">
                  <p className="call">{item.callsign}</p>
                  <p className="report">{publicText(item.signal_report) ?? 'No report'}</p>
                </div>
                {name ? <p className="person">{name}</p> : null}
                <p className="person">
                  <span className="dot" style={{ background: colours.get(item.repeater) ?? '#8a3d00' }} />
                  {item.repeater}
                </p>
              </li>
            )
          })}
        </ul>
      </section>
      {sheetOpen && draft ? (
        <ReportSheet
          repeaters={list}
          busy={busy}
          onClose={() => setSheetOpen(false)}
          onSubmit={(repeater, signal) => void save(repeater, signal)}
        />
      ) : null}
    </div>
  )
}

function FilterChip({
  label,
  colour,
  on,
  onClick,
}: {
  label: string
  colour: string | null
  on: boolean
  onClick: () => void
}) {
  return (
    <button type="button" className={on ? 'chip on' : 'chip'} aria-pressed={on} onClick={onClick}>
      {colour ? <span className="dot" style={{ background: on ? 'currentColor' : colour }} /> : null}
      {label}
    </button>
  )
}

function CoverageMap({
  reports,
  repeaters,
  filter,
  colours,
  names,
  draft,
  placing,
  onPick,
}: {
  reports: CoverageReport[]
  repeaters: Repeater[]
  filter: string
  colours: Map<string, string>
  names: Map<string, { display_name: string | null }>
  draft: { lat: number; lng: number } | null
  placing: boolean
  onPick: (lat: number, lng: number) => void
}) {
  const holder = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const layerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const pickRef = useRef(onPick)
  const placingRef = useRef(placing)
  const fitted = useRef(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    pickRef.current = onPick
    placingRef.current = placing
  }, [onPick, placing])

  useEffect(() => {
    const el = holder.current
    if (!el) return
    const map = L.map(el, { scrollWheelZoom: false }).setView([MAP_HOME.lat, MAP_HOME.lng], 11)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    map.on('click', (event) => {
      if (!placingRef.current) return
      pickRef.current(event.latlng.lat, event.latlng.lng)
    })
    mapRef.current = map
    const timer = window.setTimeout(() => {
      map.invalidateSize()
      setReady(true)
    }, 60)
    return () => {
      window.clearTimeout(timer)
      map.remove()
      mapRef.current = null
      layerRef.current = null
      fitted.current = false
      setReady(false)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!ready || !map || !layer) return
    map.invalidateSize()
    drawMarkers(map, layer, { reports, repeaters, filter, colours, names, draft, fitted })
  }, [ready, reports, repeaters, filter, colours, names, draft])

  return (
    <div
      ref={holder}
      className={placing ? 'coverage-map placing' : 'coverage-map'}
      role="application"
      aria-label="Coverage map centred on Cwmbran and Newport"
      aria-describedby="map-help"
    />
  )
}

function drawMarkers(
  map: L.Map,
  layer: L.LayerGroup,
  input: {
    reports: CoverageReport[]
    repeaters: Repeater[]
    filter: string
    colours: Map<string, string>
    names: Map<string, { display_name: string | null }>
    draft: { lat: number; lng: number } | null
    fitted: { current: boolean }
  },
) {
  layer.clearLayers()
  const sites = repeaterSites(input.repeaters).filter(
    (site) => input.filter === 'all' || site.callsigns.includes(input.filter),
  )
  const bounds: import('leaflet').LatLngTuple[] = []
  for (const site of sites) {
    const colour = input.colours.get(site.callsigns[0] ?? '') ?? '#8a3d00'
    const marker = L.circleMarker([site.lat, site.lng], {
      radius: 10,
      color: colour,
      weight: 3,
      fillColor: '#fffaf2',
      fillOpacity: 1,
      bubblingMouseEvents: false,
    })
    const lines = site.callsigns.map((callsign) => `<strong>${esc(callsign)}</strong>`).join('<br>')
    const place = site.place ? `<br>${esc(site.place)}` : ''
    marker.bindPopup(`${lines}${place}`)
    marker.addTo(layer)
    bounds.push([site.lat, site.lng])
  }
  for (const report of input.reports) {
    const colour = input.colours.get(report.repeater) ?? '#8a3d00'
    const marker = L.circleMarker([report.lat, report.lng], {
      radius: 7,
      color: '#1c140c',
      weight: 1,
      fillColor: colour,
      fillOpacity: 0.92,
      bubblingMouseEvents: false,
    })
    const name = publicText(input.names.get(report.callsign)?.display_name ?? null)
    const who = name ? `${esc(report.callsign)} · ${esc(name)}` : esc(report.callsign)
    const signal = publicText(report.signal_report) ?? 'No report'
    marker.bindPopup(`<strong>${who}</strong><br>${esc(report.repeater)} · ${esc(signal)}`)
    marker.addTo(layer)
    bounds.push([report.lat, report.lng])
  }
  if (input.draft) {
    L.circleMarker([input.draft.lat, input.draft.lng], {
      radius: 11,
      color: '#8a3d00',
      weight: 3,
      dashArray: '4 4',
      fillColor: '#f0b429',
      fillOpacity: 0.85,
      bubblingMouseEvents: false,
    })
      .bindPopup('This spot, rounded to about 100 metres')
      .addTo(layer)
  }
  if (!input.fitted.current && bounds.length > 0) {
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 12 })
    input.fitted.current = true
  }
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === '&') return '&amp;'
    if (char === '<') return '&lt;'
    if (char === '>') return '&gt;'
    return char === '"' ? '&quot;' : '&#39;'
  })
}

function ReportSheet({
  repeaters,
  busy,
  onClose,
  onSubmit,
}: {
  repeaters: Repeater[]
  busy: boolean
  onClose: () => void
  onSubmit: (repeater: string, signal: string) => void
}) {
  const [repeater, setRepeater] = useState(repeaters.find((item) => item.callsign === 'GB3YA')?.callsign ?? repeaters[0]?.callsign ?? '')
  const [signal, setSignal] = useState(SIGNALS[0])
  const [error, setError] = useState<string | null>(null)
  useScrollLock(true)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!repeater) {
      setError('Choose a repeater.')
      return
    }
    if (!signal) {
      setError('Choose a signal report.')
      return
    }
    onSubmit(repeater, signal)
  }

  return (
    <div className="sheet-wrap">
      <button type="button" className="backdrop" aria-label="Close" onClick={onClose} />
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby="report-title" onSubmit={submit}>
        <div className="grabber" aria-hidden="true" />
        <h2 id="report-title">Coverage report</h2>
        <p className="muted">We store the spot to about 100 metres, not your exact address.</p>
        <p className="field-label" id="repeater-label">
          Repeater
        </p>
        <div className="signal-row" role="group" aria-labelledby="repeater-label">
          {repeaters.map((item) => (
            <button
              key={item.id}
              type="button"
              className={repeater === item.callsign ? 'chip on' : 'chip'}
              aria-pressed={repeater === item.callsign}
              onClick={() => setRepeater(item.callsign)}
            >
              {item.callsign}
            </button>
          ))}
        </div>
        <p className="field-label" id="signal-label">
          Signal report
        </p>
        <div className="signal-row" role="group" aria-labelledby="signal-label">
          {SIGNALS.map((item) => (
            <button
              key={item}
              type="button"
              className={signal === item ? 'chip on' : 'chip'}
              aria-pressed={signal === item}
              onClick={() => setSignal(item)}
            >
              {item}
            </button>
          ))}
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" className="btn btn-primary" disabled={busy || repeaters.length === 0}>
          {busy ? 'Saving…' : 'Save report'}
        </button>
      </form>
    </div>
  )
}
