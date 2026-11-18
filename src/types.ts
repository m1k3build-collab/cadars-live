export type MemberRole = 'member' | 'controller' | 'committee'

export type Member = {
  id: string
  user_id: string | null
  callsign: string
  display_name: string | null
  role: MemberRole
  created_at: string
}

export type OnAirRow = {
  id: string
  callsign: string
  frequency: string
  note: string | null
  expires_at: string
  created_at: string
}

export type Net = {
  id: string
  date: string
  controller_callsign: string | null
  repeater: string
  notes: string | null
  created_at: string
}

export type Checkin = {
  id: string
  net_id: string
  callsign: string
  signal_report: string | null
  created_at: string
}

export type NetBundle = Net & { checkins: Checkin[] }

export type Repeater = {
  id: string
  callsign: string
  location: string | null
  output: number | string | null
  input: number | string | null
  ctcss: number | string | null
  notes: string | null
  created_at: string
}

export type ClubEvent = {
  id: string
  title: string
  date: string
  location: string | null
  description: string | null
  created_at: string
}

export type DirectoryEntry = {
  callsign: string
  display_name: string | null
  role: MemberRole
}

export type Tab = 'air' | 'net' | 'repeaters' | 'club'
