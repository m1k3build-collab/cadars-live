import { useRepeaters } from '../hooks.ts'
import { formatCtcss, formatFrequency, memberFacingNote, mhzString, publicText, sortRepeaters } from '../lib/format.ts'
import type { Repeater } from '../types.ts'

export function RepeatersScreen() {
  const { rows, error, loading, reload } = useRepeaters()
  const list = sortRepeaters(rows ?? [])

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <h1>Repeaters</h1>
          <p className="lede">Listen on the output. Your radio transmits on the input.</p>
        </div>
      </header>

      {loading ? (
        <div className="stack" aria-hidden="true">
          <div className="skeleton tall" />
          <div className="skeleton tall" />
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

      {!loading && !error && list.length === 0 ? (
        <div className="empty">
          <p>The committee has not added any repeaters yet.</p>
        </div>
      ) : null}

      <ul className="repeater-list">
        {list.map((item) => (
          <RepeaterCard key={item.id} item={item} />
        ))}
      </ul>
    </div>
  )
}

function showFreq(value: number | string | null): string {
  if (value == null || value === '') return 'Not listed'
  return formatFrequency(mhzString(value, ''))
}

function RepeaterCard({ item }: { item: Repeater }) {
  const club = item.callsign === 'GB3YA'
  const place = publicText(item.location)
  const note = memberFacingNote(item.notes)
  const tone = formatCtcss(item.ctcss)
  return (
    <li className={club ? 'repeater club' : 'repeater'}>
      <div className="row">
        <p className="call">{item.callsign}</p>
        {club ? <span className="tag">Club repeater</span> : null}
      </div>
      {place ? <p className="person">{place}</p> : null}
      <dl className="spec">
        <div>
          <dt>Listen</dt>
          <dd>{showFreq(item.output)}</dd>
        </div>
        <div>
          <dt>Transmit</dt>
          <dd>{showFreq(item.input)}</dd>
        </div>
        <div>
          <dt>Tone</dt>
          <dd>{tone ?? 'None listed'}</dd>
        </div>
      </dl>
      {note ? <p className="note">{note}</p> : null}
    </li>
  )
}
