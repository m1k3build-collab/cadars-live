import { useApp } from '../state.tsx'

export function ApprovalNote() {
  const { demo, member } = useApp()
  if (demo || !member || member.status === 'approved') return null
  const rejected = member.status === 'rejected'
  return (
    <div className="panel" role="status">
      <p className="kicker">{rejected ? 'Not approved' : 'Waiting for approval'}</p>
      <p>
        {rejected
          ? 'The committee has not approved this callsign. You can still read the lists.'
          : 'You can read everything. A committee member needs to approve you before you can post.'}
      </p>
    </div>
  )
}
