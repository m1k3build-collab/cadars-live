import { useState } from 'react'
import { DEMO_OPERATOR, demoSetMemberRole, demoSetMemberStatus } from '../lib/demo.ts'
import { friendlyMessage, publicText, roleLabel } from '../lib/format.ts'
import { setMemberRole, setMemberStatus } from '../lib/live.ts'
import { useMembers } from '../hooks.ts'
import { useApp } from '../state.tsx'
import type { Member, MemberRole } from '../types.ts'

const ROLES: MemberRole[] = ['member', 'controller', 'committee', 'admin']

export function MembersScreen() {
  const { demo, committee, member, session, toast, setTab } = useApp()
  const { rows, error, loading, reload } = useMembers()
  const [busyId, setBusyId] = useState<string | null>(null)
  const people = rows ?? []
  const pending = people.filter((row) => row.status === 'pending')
  const rejected = people.filter((row) => row.status === 'rejected')
  const approved = people
    .filter((row) => row.status === 'approved')
    .sort((a, b) => a.callsign.localeCompare(b.callsign))

  async function update(row: Member, action: () => Promise<void> | void, message: string) {
    setBusyId(row.id)
    try {
      await action()
      if (!demo) await reload()
      toast(message)
    } catch (err) {
      toast(friendlyMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  function yours(row: Member): boolean {
    if (demo) return row.callsign === DEMO_OPERATOR.callsign
    return Boolean(row.user_id && row.user_id === session?.user.id)
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <h1>New members</h1>
          <p className="lede">Approve a callsign before that person can post.</p>
        </div>
      </header>
      <button type="button" className="text-btn" onClick={() => setTab('club')}>
        Back to the diary
      </button>

      {!committee ? (
        <div className="panel">
          <p>A committee member reviews new callsigns.</p>
          {member?.status === 'pending' ? <p>You are waiting for approval.</p> : null}
          {member?.status === 'rejected' ? <p>The committee has not approved your callsign.</p> : null}
        </div>
      ) : null}

      {committee && loading ? <div className="skeleton" aria-hidden="true" /> : null}
      {committee && error && !rows ? (
        <div className="error-box" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn-line" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      ) : null}

      {committee && !loading ? (
        <section>
          <h2>Waiting</h2>
          {pending.length === 0 ? <p className="muted">No one is waiting just now.</p> : null}
          <ul className="station-list">
            {pending.map((row) => (
              <li key={row.id} className="station">
                <p className="call">{row.callsign}</p>
                {publicText(row.display_name) ? <p className="person">{publicText(row.display_name)}</p> : null}
                <div className="pair">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busyId === row.id}
                    onClick={() =>
                      void update(
                        row,
                        () => (demo ? demoSetMemberStatus(row.id, 'approved') : setMemberStatus(row.id, 'approved')),
                        `${row.callsign} is approved.`,
                      )
                    }
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={busyId === row.id}
                    onClick={() =>
                      void update(
                        row,
                        () => (demo ? demoSetMemberStatus(row.id, 'rejected') : setMemberStatus(row.id, 'rejected')),
                        `${row.callsign} was not approved.`,
                      )
                    }
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {committee && rejected.length > 0 ? (
        <details className="past">
          <summary>Not approved ({rejected.length})</summary>
          <ul className="station-list">
            {rejected.map((row) => (
              <li key={row.id} className="station">
                <p className="call">{row.callsign}</p>
                {publicText(row.display_name) ? <p className="person">{publicText(row.display_name)}</p> : null}
                <button
                  type="button"
                  className="btn btn-line"
                  disabled={busyId === row.id}
                  onClick={() =>
                    void update(
                      row,
                      () => (demo ? demoSetMemberStatus(row.id, 'approved') : setMemberStatus(row.id, 'approved')),
                      `${row.callsign} is approved.`,
                    )
                  }
                >
                  Approve
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {committee && approved.length > 0 ? (
        <section>
          <h2>Roles</h2>
          <p className="hint">Committee and admin can change the diary. Everyone approved can post.</p>
          <ul className="station-list">
            {approved.map((row) => {
              const mine = yours(row)
              return (
                <li key={row.id} className="station">
                  <p className="call">
                    {row.callsign}
                    {mine ? <span className="you-tag">You</span> : null}
                  </p>
                  {publicText(row.display_name) ? <p className="person">{publicText(row.display_name)}</p> : null}
                  <label className="field-label" htmlFor={`role-${row.id}`}>
                    Role
                  </label>
                  <select
                    id={`role-${row.id}`}
                    className="field"
                    value={row.role}
                    disabled={mine || busyId === row.id}
                    onChange={(event) => {
                      const role = event.target.value as MemberRole
                      void update(
                        row,
                        () => (demo ? demoSetMemberRole(row.id, role) : setMemberRole(row.id, role)),
                        `${row.callsign} is now ${roleLabel(role).toLowerCase()}.`,
                      )
                    }}
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {roleLabel(role)}
                      </option>
                    ))}
                  </select>
                  {mine ? <p className="hint">Ask another committee member to change your own role.</p> : null}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
