import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  attendanceTally,
  awardCallsigns,
  formatFrequency,
  londonParts,
  memberFacingNote,
  nextWednesdayEvening,
  prepareCallsign,
  publicText,
  timeLeft,
  zonedTimeToIso,
} from './format.ts'

test('strips postcodes and phone numbers from public text', () => {
  assert.equal(publicText('Example Hall, AB1 2CD'), 'Example Hall')
  assert.equal(publicText('Hall 00000 000000'), 'Hall')
  assert.equal(publicText('Cwmbran'), 'Cwmbran')
})

test('hides the internal repeater warning and keeps a useful note', () => {
  assert.equal(memberFacingNote('Verify on ukrepeater.net before publishing'), null)
  assert.equal(
    memberFacingNote('Verify on ukrepeater.net before publishing. Likely a digital repeater (analogue + DMR).'),
    'Likely a digital repeater (analogue + DMR).',
  )
})

test('accepts the sample callsigns and rejects rubbish', () => {
  for (const call of ['M7ABC', '2E0XYZ', 'MW6DEF', 'GW4XYZ', 'MW0CAD']) {
    const parsed = prepareCallsign(call.toLowerCase())
    assert.equal(parsed.ok, true)
    if (parsed.ok) assert.equal(parsed.callsign, call)
  }
  assert.equal(prepareCallsign('MW6DEF/P').ok, false)
  assert.equal(prepareCallsign('hello').ok, false)
  assert.equal(prepareCallsign('person@example.com').ok, false)
})

test('formats frequencies the way a radio display would', () => {
  assert.equal(formatFrequency('145.7125'), '145.7125 MHz')
  assert.equal(formatFrequency('145.5'), '145.500 MHz')
  assert.equal(formatFrequency('145.500'), '145.500 MHz')
})

test('counts down an hour and hides an expired row', () => {
  const now = Date.parse('2026-11-18T20:00:00Z')
  const left = timeLeft('2026-11-18T20:40:00Z', now)
  assert.equal(left?.minutes, 40)
  assert.equal(left?.label, '40 min left')
  assert.equal(timeLeft('2026-11-18T19:00:00Z', now), null)
})

test('London wall time survives GMT and BST', () => {
  assert.equal(zonedTimeToIso('2026-11-25', 19, 0), '2026-11-25T19:00:00.000Z')
  assert.equal(zonedTimeToIso('2026-07-15', 19, 0), '2026-07-15T18:00:00.000Z')
  const winter = londonParts(new Date('2026-11-25T19:00:00Z'))
  assert.equal(winter.isoDate, '2026-11-25')
  assert.equal(winter.hour, 19)
  assert.equal(winter.weekdayIndex, 3)
})

test('keeps the November club night until that evening is over', () => {
  assert.equal(
    nextWednesdayEvening(new Date('2026-11-18T21:00:00Z')),
    '2026-11-25T19:00:00.000Z',
  )
})

test('attendance badge goes to the most regular member, and only after three nets', () => {
  const tally = attendanceTally([
    { callsign: 'gw4xyz', net_id: 'a' },
    { callsign: 'GW4XYZ', net_id: 'b' },
    { callsign: 'GW4XYZ', net_id: 'c' },
    { callsign: 'MW6DEF', net_id: 'a' },
    { callsign: 'MW6DEF', net_id: 'b' },
  ])
  assert.deepEqual(tally, [
    { callsign: 'GW4XYZ', nights: 3 },
    { callsign: 'MW6DEF', nights: 2 },
  ])
  assert.deepEqual([...awardCallsigns(tally)], ['GW4XYZ'])
  assert.equal(awardCallsigns([{ callsign: 'MW6DEF', nights: 2 }]).size, 0)
})
