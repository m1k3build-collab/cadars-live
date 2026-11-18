import type { Repeater } from '../types.ts'
import { publicText } from './format.ts'

/** Published repeater sites. Member reports are stored separately and rounded. */
export const REPEATER_SITES: Record<string, { lat: number; lng: number }> = {
  GB3YA: { lat: 51.6399, lng: -3.061 },
  GB3AA: { lat: 51.5916, lng: -2.5394 },
  GB3BC: { lat: 51.6119, lng: -3.3033 },
  GB3MG: { lat: 51.6119, lng: -3.3033 },
  GB7GE: { lat: 51.5186, lng: -3.2116 },
}

export const MAP_HOME = { lat: 51.62, lng: -3.02 }

export const REPEATER_COLOURS = [
  '#8a3d00',
  '#0d6b3c',
  '#1d4e89',
  '#9f1239',
  '#6d28d9',
  '#0f766e',
  '#b45309',
  '#3f3f46',
]

export type RepeaterSite = {
  callsigns: string[]
  lat: number
  lng: number
  place: string | null
}

export function repeaterColour(callsign: string, all: string[]): string {
  const sorted = [...new Set(all.map((item) => item.toUpperCase()))].sort()
  const index = sorted.indexOf(callsign.toUpperCase())
  return REPEATER_COLOURS[(index < 0 ? 0 : index) % REPEATER_COLOURS.length]
}

export function repeaterSites(rows: Repeater[]): RepeaterSite[] {
  const grouped = new Map<string, RepeaterSite>()
  for (const row of rows) {
    const known = REPEATER_SITES[row.callsign.toUpperCase()]
    if (!known) continue
    const key = `${known.lat.toFixed(4)},${known.lng.toFixed(4)}`
    const place = publicText(row.location)
    const existing = grouped.get(key)
    if (existing) {
      existing.callsigns.push(row.callsign)
      if (!existing.place && place) existing.place = place
      continue
    }
    grouped.set(key, { callsigns: [row.callsign], lat: known.lat, lng: known.lng, place })
  }
  return [...grouped.values()]
}
