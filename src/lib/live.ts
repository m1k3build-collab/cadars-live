import type {
  Checkin,
  ClubEvent,
  CoverageReport,
  DirectoryEntry,
  Member,
  MemberRole,
  MemberStatus,
  Net,
  NetBundle,
  OnAirRow,
  Repeater,
} from '../types.ts'
import { prepareCallsign, prepareUkCallsign, publicText, roundCoord } from './format.ts'
import { supabase } from './supabase.ts'

type DbError = { message: string; code?: string; details?: string | null }

function fail(error: DbError | null): void {
  if (error) throw error
}

export async function fetchOnAir(): Promise<OnAirRow[]> {
  const { data, error } = await supabase
    .from('on_air_current')
    .select('id, callsign, frequency, note, expires_at, created_at')
    .order('created_at', { ascending: false })
  fail(error)
  return (data ?? []) as OnAirRow[]
}

export async function goOnAir(callsign: string, frequency: string, note: string | null): Promise<void> {
  const parsed = prepareCallsign(callsign)
  if (!parsed.ok) throw new Error(parsed.message)
  const removed = await supabase.from('on_air').delete().eq('callsign', parsed.callsign)
  fail(removed.error)
  const inserted = await supabase.from('on_air').insert({
    callsign: parsed.callsign,
    frequency: frequency.trim(),
    note: note?.trim() || null,
  })
  fail(inserted.error)
}

export async function clearOnAir(callsign: string): Promise<void> {
  const parsed = prepareCallsign(callsign)
  if (!parsed.ok) throw new Error(parsed.message)
  const removed = await supabase.from('on_air').delete().eq('callsign', parsed.callsign)
  fail(removed.error)
}

export async function fetchYearNets(year: number): Promise<NetBundle[]> {
  const { data, error } = await supabase
    .from('nets')
    .select(
      'id, date, controller_callsign, repeater, notes, created_at, checkins(id, net_id, callsign, signal_report, created_at)',
    )
    .gte('date', `${year}-01-01`)
    .lt('date', `${year + 1}-01-01`)
    .order('date', { ascending: false })
  fail(error)
  return ((data ?? []) as NetBundle[]).map((net) => ({
    ...net,
    checkins: [...(net.checkins ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)),
  }))
}

export async function startNet(date: string, controller: string): Promise<Net> {
  const parsed = prepareCallsign(controller)
  if (!parsed.ok) throw new Error(parsed.message)
  const { data, error } = await supabase
    .from('nets')
    .insert({ date, controller_callsign: parsed.callsign, repeater: 'GB3YA' })
    .select('id, date, controller_callsign, repeater, notes, created_at')
    .single()
  fail(error)
  return data as Net
}

export async function checkIn(netId: string, callsign: string, signal: string | null): Promise<Checkin> {
  const parsed = prepareCallsign(callsign)
  if (!parsed.ok) throw new Error(parsed.message)
  const { data, error } = await supabase
    .from('checkins')
    .insert({
      net_id: netId,
      callsign: parsed.callsign,
      signal_report: signal?.trim() || null,
    })
    .select('id, net_id, callsign, signal_report, created_at')
    .single()
  fail(error)
  return data as Checkin
}

export async function fetchRepeaters(): Promise<Repeater[]> {
  const { data, error } = await supabase
    .from('repeaters')
    .select('id, callsign, location, output, input, ctcss, notes, created_at')
    .order('callsign')
  fail(error)
  return (data ?? []) as Repeater[]
}

export async function fetchEvents(): Promise<ClubEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id, title, date, location, description, created_at')
    .order('date', { ascending: true })
  fail(error)
  return (data ?? []) as ClubEvent[]
}

export async function fetchDirectory(): Promise<DirectoryEntry[]> {
  const { data, error } = await supabase
    .from('members')
    .select('callsign, display_name, role')
    .eq('status', 'approved')
  fail(error)
  return (data ?? []) as DirectoryEntry[]
}

const MEMBER_COLUMNS = 'id, user_id, callsign, display_name, role, status, created_at'

export async function fetchMember(userId: string): Promise<Member | null> {
  const { data, error } = await supabase.from('members').select(MEMBER_COLUMNS).eq('user_id', userId).maybeSingle()
  fail(error)
  return (data as Member | null) ?? null
}

export async function fetchMembers(): Promise<Member[]> {
  const { data, error } = await supabase.from('members').select(MEMBER_COLUMNS).order('created_at', { ascending: true })
  fail(error)
  return (data ?? []) as Member[]
}

export async function saveMember(
  userId: string,
  callsign: string,
  displayName: string,
  existing: boolean,
): Promise<Member> {
  const parsed = prepareUkCallsign(callsign)
  if (!parsed.ok) throw new Error(parsed.message)
  const payload = { callsign: parsed.callsign, display_name: displayName.trim() }
  if (existing) {
    const { data, error } = await supabase
      .from('members')
      .update(payload)
      .eq('user_id', userId)
      .select(MEMBER_COLUMNS)
      .single()
    fail(error)
    return data as Member
  }
  const { data, error } = await supabase
    .from('members')
    .insert({ ...payload, user_id: userId, role: 'member', status: 'pending' })
    .select(MEMBER_COLUMNS)
    .single()
  fail(error)
  return data as Member
}

export async function setMemberStatus(id: string, status: Extract<MemberStatus, 'approved' | 'rejected'>): Promise<void> {
  const { data, error } = await supabase.from('members').update({ status }).eq('id', id).select('id')
  fail(error)
  if (!data?.length) throw { code: '42501', message: 'permission denied' }
}

export async function setMemberRole(id: string, role: MemberRole): Promise<void> {
  const { data, error } = await supabase.from('members').update({ role }).eq('id', id).select('id')
  fail(error)
  if (!data?.length) throw { code: '42501', message: 'permission denied' }
}

export async function fetchCoverage(): Promise<CoverageReport[]> {
  const { data, error } = await supabase
    .from('coverage_reports')
    .select('id, callsign, lat, lng, signal_report, repeater, created_at')
    .order('created_at', { ascending: false })
  fail(error)
  return (data ?? []) as CoverageReport[]
}

export async function addCoverageReport(input: {
  callsign: string
  lat: number
  lng: number
  repeater: string
  signal: string
}): Promise<void> {
  const parsed = prepareUkCallsign(input.callsign)
  if (!parsed.ok) throw new Error(parsed.message)
  const repeaterName = input.repeater.trim().toUpperCase()
  if (!/^[A-Z0-9]{3,8}$/.test(repeaterName)) throw new Error('Choose a repeater.')
  const signal = publicText(input.signal)?.slice(0, 40) ?? null
  if (!signal) throw new Error('Choose a signal report.')
  const { error } = await supabase.from('coverage_reports').insert({
    callsign: parsed.callsign,
    lat: roundCoord(input.lat),
    lng: roundCoord(input.lng),
    repeater: repeaterName,
    signal_report: signal,
  })
  fail(error)
}

const EVENT_COLUMNS = 'id, title, date, location, description, created_at'

export async function saveEvent(input: {
  id?: string
  title: string
  date: string
  location: string | null
  description: string | null
}): Promise<void> {
  const payload = {
    title: input.title,
    date: input.date,
    location: input.location,
    description: input.description,
  }
  if (input.id) {
    const { error } = await supabase.from('events').update(payload).eq('id', input.id).select(EVENT_COLUMNS).single()
    fail(error)
    return
  }
  const { error } = await supabase.from('events').insert(payload).select(EVENT_COLUMNS).single()
  fail(error)
}

export async function deleteEvent(id: string): Promise<void> {
  const { data, error } = await supabase.from('events').delete().eq('id', id).select('id')
  fail(error)
  if (!data?.length) throw { code: '42501', message: 'permission denied' }
}

export async function sendEmailCode(email: string): Promise<void> {
  const redirect = new URL(window.location.href)
  redirect.hash = ''
  redirect.search = ''
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: true, emailRedirectTo: redirect.toString() },
  })
  fail(error)
}

export async function verifyEmailCode(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type: 'email',
  })
  fail(error)
}
