import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || 'https://kzzqrormwligrdbrxsrw.supabase.co'
const key = process.env.SUPABASE_KEY || 'sb_publishable_isMS7d3wwjP2NRJzlRR4lA_TVrMTmS1'
const anon = createClient(url, key)

const repeaters = await anon.from('repeaters').select('callsign').order('callsign')
if (repeaters.error) throw repeaters.error
console.log('repeaters', repeaters.data.map((row) => row.callsign).join(', '))

const events = await anon.from('events').select('title, date, location')
if (events.error) throw events.error
console.log('events', events.data)

const air = await anon.from('on_air_current').select('callsign, frequency')
if (air.error) throw air.error
console.log('on air before', air.data)

const blocked = await anon.from('on_air').insert({ callsign: 'MW9CAD', frequency: '145.500', note: 'should fail' })
console.log('anon insert blocked', Boolean(blocked.error), blocked.error?.code, blocked.error?.message)

const email = process.env.TEST_EMAIL
const password = process.env.TEST_PASSWORD
if (!email || !password) {
  console.log('skipping signed-in writes; set TEST_EMAIL and TEST_PASSWORD')
  process.exit(0)
}

const authed = createClient(url, key)
const signed = await authed.auth.signInWithPassword({ email, password })
if (signed.error) throw signed.error
const userId = signed.data.user.id
console.log('signed in', userId)

const member = await authed.from('members').insert({
  user_id: userId,
  callsign: 'mw9cad',
  display_name: 'Live check',
}).select('callsign, display_name').single()
if (member.error) throw member.error
console.log('member stored as', member.data.callsign)

let markSubscribed = () => {}
const subscribed = new Promise((resolve) => {
  markSubscribed = resolve
})
const channelReady = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('realtime subscribe timed out')), 15000)
  anon.channel('live-check')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'on_air' }, (payload) => {
      if (payload.new?.callsign === 'MW9CAD') {
        clearTimeout(timer)
        resolve(payload.new)
      }
    })
    .subscribe((status) => {
      console.log('realtime', status)
      if (status === 'SUBSCRIBED') markSubscribed()
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer)
        reject(new Error(`realtime ${status}`))
      }
    })
})

await subscribed
const onAir = await authed.from('on_air').insert({
  callsign: 'MW9CAD',
  frequency: '145.7125',
  note: 'Live check',
}).select('callsign, frequency, expires_at').single()
if (onAir.error) throw onAir.error
console.log('on air row', onAir.data)

const event = await channelReady
console.log('realtime saw', event.callsign, event.frequency)

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date())
const net = await authed.from('nets').insert({
  date: today,
  controller_callsign: 'mw9cad',
  repeater: 'GB3YA',
}).select('id, controller_callsign, repeater').single()
if (net.error) throw net.error
console.log('net', net.data)

const checkin = await authed.from('checkins').insert({
  net_id: net.data.id,
  callsign: 'm7abc',
  signal_report: '5/9',
}).select('callsign, signal_report').single()
if (checkin.error) throw checkin.error
console.log('checkin', checkin.data)

const again = await authed.from('checkins').insert({ net_id: net.data.id, callsign: 'M7ABC' })
console.log('duplicate blocked', again.error?.code)

const cleared = await authed.from('on_air').delete().eq('callsign', 'MW9CAD').select('id')
if (cleared.error) throw cleared.error
console.log('cleared on air', cleared.data?.length ?? 0)

const removedCheckins = await authed.from('checkins').delete().eq('net_id', net.data.id)
console.log('checkin delete', removedCheckins.error ? removedCheckins.error.message : 'ok')
const removedNet = await authed.from('nets').delete().eq('id', net.data.id)
console.log('net delete', removedNet.error ? removedNet.error.message : 'ok')
const removedMember = await authed.from('members').delete().eq('user_id', userId)
console.log('member delete', removedMember.error ? removedMember.error.message : 'ok')

await anon.removeAllChannels()
console.log('live check complete')
