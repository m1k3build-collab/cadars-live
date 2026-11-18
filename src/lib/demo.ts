import type { Checkin, ClubEvent, DirectoryEntry, Net, NetBundle, OnAirRow, Repeater } from '../types.ts'
import { londonParts, nextWednesdayEvening, prepareCallsign } from './format.ts'

export const DEMO_OPERATOR = { callsign: 'MW0CAD', displayName: 'Demo guest' }

const PEOPLE: DirectoryEntry[] = [
  { callsign: 'GW4XYZ', display_name: 'Glyn', role: 'controller' },
  { callsign: 'MW6DEF', display_name: 'Dewi', role: 'member' },
  { callsign: '2E0XYZ', display_name: 'Sam', role: 'member' },
  { callsign: 'M7ABC', display_name: 'Alex', role: 'member' },
  { callsign: DEMO_OPERATOR.callsign, display_name: DEMO_OPERATOR.displayName, role: 'member' },
]

const PAST_NIGHTS: Record<string, number> = {
  GW4XYZ: 16,
  MW6DEF: 12,
  '2E0XYZ': 8,
  M7ABC: 6,
  MW0CAD: 4,
}

type DemoState = {
  onAir: OnAirRow[]
  nets: Net[]
  checkins: Checkin[]
  repeaters: Repeater[]
  events: ClubEvent[]
  directory: DirectoryEntry[]
}

let state = createDemoState(Date.now())
const listeners = new Set<() => void>()

function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function recentMondays(todayIso: string, count: number): string[] {
  const [year, month, day] = todayIso.split('-').map(Number)
  const cursor = new Date(Date.UTC(year, month - 1, day))
  const out: string[] = []
  for (let i = 0; i < 370 && out.length < count; i += 1) {
    cursor.setUTCDate(cursor.getUTCDate() - 1)
    const iso = cursor.toISOString().slice(0, 10)
    if (!iso.startsWith(String(year))) break
    if (cursor.getUTCDay() === 1) out.push(iso)
  }
  return out
}

function repeater(
  callsign: string,
  location: string,
  output: number,
  input: number,
  ctcss: number,
  notes: string,
): Repeater {
  return {
    id: uid(),
    callsign,
    location,
    output,
    input,
    ctcss,
    notes,
    created_at: '2026-01-01T00:00:00.000Z',
  }
}

export function createDemoState(now: number): DemoState {
  const today = londonParts(new Date(now)).isoDate
  const mondays = recentMondays(today, 16)
  const nets: Net[] = []
  const checkins: Checkin[] = []

  mondays.forEach((date, index) => {
    const netId = uid()
    nets.push({
      id: netId,
      date,
      controller_callsign: 'GW4XYZ',
      repeater: 'GB3YA',
      notes: null,
      created_at: `${date}T19:00:00.000Z`,
    })
    for (const [callsign, nights] of Object.entries(PAST_NIGHTS)) {
      if (index < nights) {
        checkins.push({
          id: uid(),
          net_id: netId,
          callsign,
          signal_report: '5/9',
          created_at: `${date}T19:10:00.000Z`,
        })
      }
    }
  })

  const tonightId = uid()
  nets.unshift({
    id: tonightId,
    date: today,
    controller_callsign: 'GW4XYZ',
    repeater: 'GB3YA',
    notes: null,
    created_at: new Date(now - 20 * 60 * 1000).toISOString(),
  })
  const tonight: Array<[string, string, number]> = [
    ['GW4XYZ', '5/9', 12],
    ['MW6DEF', '5/9', 9],
    ['2E0XYZ', '5/7', 4],
  ]
  for (const [callsign, report, minutesAgo] of tonight) {
    checkins.push({
      id: uid(),
      net_id: tonightId,
      callsign,
      signal_report: report,
      created_at: new Date(now - minutesAgo * 60 * 1000).toISOString(),
    })
  }

  const air = (callsign: string, frequency: string, note: string, minutesLeft: number): OnAirRow => ({
    id: uid(),
    callsign,
    frequency,
    note,
    created_at: new Date(now - (60 - minutesLeft) * 60 * 1000).toISOString(),
    expires_at: new Date(now + minutesLeft * 60 * 1000).toISOString(),
  })

  return {
    onAir: [
      air('GW4XYZ', '145.7125', 'Monitoring', 52),
      air('MW6DEF', '145.7125', 'Listening on the repeater', 40),
      air('2E0XYZ', '145.500', 'Calling CQ', 18),
    ],
    nets,
    checkins,
    directory: PEOPLE,
    repeaters: [
      repeater('GB3YA', 'Cwmbran', 145.7125, 145.1125, 94.8, 'Verify on ukrepeater.net before publishing'),
      repeater('GB3AA', 'Bristol', 145.6625, 145.0625, 94.8, 'Verify on ukrepeater.net before publishing'),
      repeater('GB3BC', 'Pontypridd', 145.75, 145.15, 94.8, 'Verify on ukrepeater.net before publishing'),
      repeater('GB3MG', 'Pontypridd', 430.9, 438.5, 94.8, 'Verify on ukrepeater.net before publishing'),
      repeater(
        'GB7GE',
        'Cardiff',
        430.8375,
        438.4375,
        77,
        'Verify on ukrepeater.net before publishing. Likely a digital repeater (analogue + DMR).',
      ),
      repeater('GC0CDF', 'Cardiff', 430.8125, 438.4125, 94.8, 'Verify on ukrepeater.net before publishing'),
      repeater('GW8IOA', 'Newport', 430.9625, 438.5625, 88.5, 'Verify on ukrepeater.net before publishing'),
    ],
    events: [
      {
        id: uid(),
        title: 'CADARS club night',
        date: nextWednesdayEvening(new Date(now)),
        location: 'Henllys Village Hall',
        description: 'Weekly club night, 7–9pm.',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ],
  }
}

function commit(next: DemoState): void {
  state = next
  listeners.forEach((listener) => listener())
}

export function getDemoState(): DemoState {
  return state
}

export function subscribeDemo(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function resetDemo(): void {
  commit(createDemoState(Date.now()))
}

export function demoBundles(current: DemoState = state): NetBundle[] {
  return current.nets.map((net) => ({
    ...net,
    checkins: current.checkins
      .filter((checkin) => checkin.net_id === net.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
  }))
}

export function demoGoOnAir(frequency: string, note: string | null): void {
  const now = new Date().toISOString()
  const row: OnAirRow = {
    id: uid(),
    callsign: DEMO_OPERATOR.callsign,
    frequency,
    note,
    created_at: now,
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  }
  commit({
    ...state,
    onAir: [row, ...state.onAir.filter((item) => item.callsign !== DEMO_OPERATOR.callsign)],
  })
}

export function demoClearOnAir(): void {
  commit({ ...state, onAir: state.onAir.filter((item) => item.callsign !== DEMO_OPERATOR.callsign) })
}

export function demoStartNet(today: string): Net {
  const existing = state.nets.find((net) => net.date === today)
  if (existing) return existing
  const net: Net = {
    id: uid(),
    date: today,
    controller_callsign: DEMO_OPERATOR.callsign,
    repeater: 'GB3YA',
    notes: null,
    created_at: new Date().toISOString(),
  }
  commit({ ...state, nets: [net, ...state.nets] })
  return net
}

export function demoCloseTonight(today: string): void {
  const ids = new Set(state.nets.filter((net) => net.date === today).map((net) => net.id))
  commit({
    ...state,
    nets: state.nets.filter((net) => !ids.has(net.id)),
    checkins: state.checkins.filter((checkin) => !ids.has(checkin.net_id)),
  })
}

export function demoCheckIn(netId: string, callsign: string, signal: string | null): void {
  const parsed = prepareCallsign(callsign)
  if (!parsed.ok) throw new Error(parsed.message)
  if (state.checkins.some((item) => item.net_id === netId && item.callsign === parsed.callsign)) {
    throw { code: '23505', message: 'duplicate key value violates unique constraint "checkins_net_id_callsign_key"' }
  }
  const row: Checkin = {
    id: uid(),
    net_id: netId,
    callsign: parsed.callsign,
    signal_report: signal?.trim() || null,
    created_at: new Date().toISOString(),
  }
  commit({ ...state, checkins: [...state.checkins, row] })
}
