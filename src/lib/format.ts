const PHONE = /(?:\+?\d[\d\s()-]{8,}\d)/g
const POSTCODE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi

export type LondonParts = {
  year: string
  month: string
  day: string
  hour: number
  minute: number
  isoDate: string
  weekdayIndex: number
}

export function londonParts(date = new Date()): LondonParts {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const bag: Record<string, string> = {}
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') bag[part.type] = part.value
  }
  const isoDate = `${bag.year}-${bag.month}-${bag.day}`
  const [year, month, day] = isoDate.split('-').map(Number)
  let hour = Number(bag.hour)
  if (hour === 24) hour = 0
  return {
    year: bag.year,
    month: bag.month,
    day: bag.day,
    hour,
    minute: Number(bag.minute),
    isoDate,
    weekdayIndex: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  }
}

export function zonedTimeToIso(isoDate: string, hour: number, minute: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  let utc = Date.UTC(year, month - 1, day, hour, minute)
  for (let i = 0; i < 4; i += 1) {
    const parts = londonParts(new Date(utc))
    const [gy, gm, gd] = parts.isoDate.split('-').map(Number)
    const got = Date.UTC(gy, gm - 1, gd, parts.hour, parts.minute)
    const want = Date.UTC(year, month - 1, day, hour, minute)
    const diff = want - got
    if (diff === 0) break
    utc += diff
  }
  return new Date(utc).toISOString()
}

/** Next Wednesday at 7pm London. The 25 November 2026 club night stays put until that evening is over. */
export function nextWednesdayEvening(now = new Date()): string {
  if (now.getTime() <= Date.parse('2026-11-25T21:00:00Z')) {
    return new Date('2026-11-25T19:00:00Z').toISOString()
  }
  const today = londonParts(now)
  let add = (3 - today.weekdayIndex + 7) % 7
  if (add === 0 && today.hour >= 21) add = 7
  const [year, month, day] = today.isoDate.split('-').map(Number)
  const dest = new Date(Date.UTC(year, month - 1, day + add))
  return zonedTimeToIso(dest.toISOString().slice(0, 10), 19, 0)
}

export function publicText(value: string | null | undefined): string | null {
  if (!value) return null
  const cleaned = value
    .replace(PHONE, '')
    .replace(POSTCODE, '')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim()
  return cleaned || null
}

export function memberFacingNote(notes: string | null | undefined): string | null {
  if (!notes) return null
  const stripped = notes.replace(/Verify on ukrepeater\.net before publishing\.?\s*/gi, '')
  return publicText(stripped)
}

export function prepareCallsign(
  input: string,
): { ok: true; callsign: string } | { ok: false; message: string } {
  const compact = input.trim().toUpperCase().replace(/\s+/g, '')
  if (!compact) return { ok: false, message: 'Enter a callsign.' }
  if (compact.includes('/')) {
    return { ok: false, message: 'Leave off /P or /M. Just the callsign itself.' }
  }
  if (!/^[A-Z0-9]{3,8}$/.test(compact) || !/[A-Z]/.test(compact) || !/\d/.test(compact)) {
    return {
      ok: false,
      message: 'Callsigns are 3 to 8 letters and numbers, with no spaces.',
    }
  }
  return { ok: true, callsign: compact }
}

export function isDisplayName(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed.length < 1 || trimmed.length > 40) return false
  if (/\d/.test(trimmed)) return false
  return /^[\p{L}][\p{L}\s'.-]{0,39}$/u.test(trimmed)
}

export function mhzString(value: number | string | null | undefined, fallback: string): string {
  if (value == null || value === '') return fallback
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return n.toFixed(4)
}

export function formatFrequency(value: string): string {
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d{2,4}(?:\.\d{1,5})?)\s*(?:mhz)?$/i)
  if (!match) return trimmed
  const [whole, frac = ''] = match[1].split('.')
  const places = Math.min(4, Math.max(3, frac.length))
  const digits = frac.slice(0, 4).padEnd(places, '0')
  return `${whole}.${digits} MHz`
}

export function formatCtcss(value: number | string | null | undefined): string | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return `${n.toFixed(1)} Hz`
}

export function timeLeft(expiresAt: string, now: number): { label: string; minutes: number; fraction: number } | null {
  const ms = new Date(expiresAt).getTime() - now
  if (!Number.isFinite(ms) || ms <= 0) return null
  const minutes = Math.ceil(ms / 60000)
  const label = minutes <= 1 ? 'Less than a minute' : `${minutes} min left`
  return {
    label,
    minutes,
    fraction: Math.max(0, Math.min(1, ms / (60 * 60 * 1000))),
  }
}

export function formatClock(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso))
}

export function formatEventWhen(iso: string): { date: string; time: string } {
  const value = new Date(iso)
  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(value)
  return { date, time: formatClock(iso) }
}

export function latestPerCallsign<T extends { callsign: string; created_at: string }>(rows: T[]): T[] {
  const map = new Map<string, T>()
  for (const row of rows) {
    const key = row.callsign.toUpperCase()
    const prev = map.get(key)
    if (!prev || prev.created_at < row.created_at) map.set(key, row)
  }
  return [...map.values()]
}

export function activeOnAir<T extends { callsign: string; created_at: string; expires_at: string }>(
  rows: T[],
  now: number,
): T[] {
  return latestPerCallsign(rows.filter((row) => new Date(row.expires_at).getTime() > now))
}

export function sortOnAir<T extends { callsign: string; created_at: string }>(rows: T[], mine: string | null): T[] {
  return [...rows].sort((a, b) => {
    if (mine) {
      if (a.callsign === mine && b.callsign !== mine) return -1
      if (b.callsign === mine && a.callsign !== mine) return 1
    }
    return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0
  })
}

export function tonightsNet<T extends { date: string; created_at: string }>(nets: T[], today: string): T | null {
  let best: T | null = null
  for (const net of nets) {
    if (net.date !== today) continue
    if (!best || best.created_at < net.created_at) best = net
  }
  return best
}

export type TallyRow = { callsign: string; nights: number }

export function attendanceTally(checkins: { callsign: string; net_id: string }[]): TallyRow[] {
  const sets = new Map<string, Set<string>>()
  for (const checkin of checkins) {
    const callsign = checkin.callsign.toUpperCase()
    let nights = sets.get(callsign)
    if (!nights) {
      nights = new Set()
      sets.set(callsign, nights)
    }
    nights.add(checkin.net_id)
  }
  return [...sets.entries()]
    .map(([callsign, nights]) => ({ callsign, nights: nights.size }))
    .sort((a, b) => b.nights - a.nights || a.callsign.localeCompare(b.callsign))
}

export function awardCallsigns(tally: TallyRow[]): Set<string> {
  const top = tally[0]?.nights ?? 0
  if (top < 3) return new Set()
  return new Set(tally.filter((row) => row.nights === top).map((row) => row.callsign))
}

export function sortRepeaters<T extends { callsign: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.callsign === 'GB3YA') return -1
    if (b.callsign === 'GB3YA') return 1
    return a.callsign.localeCompare(b.callsign)
  })
}

export function upcomingEvents<T extends { date: string }>(events: T[], now: number): T[] {
  return [...events]
    .filter((event) => new Date(event.date).getTime() >= now - 2 * 60 * 60 * 1000)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}

export function errorCode(error: unknown): string {
  if (typeof error === 'object' && error && 'code' in error && (error as { code?: unknown }).code != null) {
    return String((error as { code: unknown }).code)
  }
  return ''
}

export function friendlyMessage(error: unknown): string {
  const code = errorCode(error)
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String((error as { message: unknown }).message)
        : ''
  const details =
    typeof error === 'object' && error && 'details' in error
      ? String((error as { details: unknown }).details ?? '')
      : ''
  const blob = `${message} ${details}`.toLowerCase()
  if (code === '23505' && blob.includes('members_callsign')) {
    return 'That callsign is already registered. If it is yours, ask a committee member.'
  }
  if (code === '23505') return 'That callsign is already on the list.'
  if (blob.includes('rate limit') || blob.includes('over_email_send_rate_limit')) {
    return 'Please wait a minute, then ask for another code.'
  }
  if (blob.includes('otp') || blob.includes('token') || blob.includes('expired')) {
    return 'That code did not work. Check it, or ask for a new one.'
  }
  if (
    blob.includes('failed to fetch') ||
    blob.includes('network') ||
    blob.includes('load failed') ||
    blob.includes('fetch')
  ) {
    return 'No connection just now. Demo mode still works on this phone.'
  }
  return 'Something went wrong. Please try again in a moment.'
}

export function stationCount(count: number): string {
  if (count === 0) return 'Nobody just now'
  if (count === 1) return '1 station'
  return `${count} stations`
}

export function nightsLabel(nights: number): string {
  return nights === 1 ? '1 net' : `${nights} nets`
}

export function pulse(): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(12)
  }
}
