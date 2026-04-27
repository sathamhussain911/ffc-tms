import { createServerSupabaseClient } from '@/lib/supabase/server'
import { formatDate, formatDateTime, tripStatusColour, priorityColour } from '@/lib/utils'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const revalidate = 15

export default async function TripsPage({
  searchParams,
}: {
  searchParams: { status?: string; branch?: string; date?: string; q?: string }
}) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: user } = await supabase.from('users').select('*, role:roles(*), branch:branches(*)').eq('id', session.user.id).single()

  const today = new Date().toISOString().split('T')[0]
  const filterDate = searchParams.date ?? today

  let query = supabase
    .from('trips')
    .select(`
      id, trip_number, status, priority, planned_start, planned_end, actual_start, actual_end,
      cargo_description,
      branch:branches(name),
      vehicle:vehicles(vehicle_number),
      driver:drivers(full_name),
      requester:users(full_name)
    `)
    .is('deleted_at', null)
    .gte('planned_start', `${filterDate}T00:00:00`)
    .lte('planned_start', `${filterDate}T23:59:59`)
    .order('planned_start')

  if (searchParams.status) query = query.eq('status', searchParams.status)
  if (searchParams.q) query = query.ilike('trip_number', `%${searchParams.q}%`)

  const { data: trips = [] } = await query
  const { data: branches = [] } = await supabase.from('branches').select('id,name').eq('status', 'active').order('name')

  const statusCounts = (trips as any[]).reduce((acc: Record<string, number>, t: any) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1
    return acc
  }, {})

  return (
    
      <div className="page-header">
        <div>
          <h1 className="page-title">Trips & Delivery</h1>
          <p className="page-subtitle">Full lifecycle — Requested → Assigned → In Progress → Completed</p>
        </div>
        <Link href="/operations/trips/new" className="btn btn-primary">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M12 4v16m8-8H4"/></svg>
          New Trip Request
        </Link>
      </div>

      {/* Status summary chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {['requested','approved','assigned','in_progress','completed','delayed','cancelled'].map(s => (
          statusCounts[s] ? (
            <span key={s} className={`badge cursor-pointer ${tripStatusColour[s]}`}>
              {s.replace('_',' ')} ({statusCounts[s]})
            </span>
          ) : null
        ))}
      </div>

      {/* Filters */}
      <form className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 h-9 flex-1 min-w-[200px] focus-within:border-primary-500">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/></svg>
          <input name="q" type="text" placeholder="Search trip number…" defaultValue={searchParams.q} className="bg-transparent outline-none text-[13px] w-full"/>
        </div>
        <input name="date" type="date" defaultValue={filterDate} className="form-control h-9 w-auto"/>
        <select name="status" defaultValue={searchParams.status} className="form-control h-9 w-auto">
          <option value="">All Statuses</option>
          {['requested','approved','assigned','in_progress','completed','delayed','cancelled'].map(s =>
            <option key={s} value={s}>{s.replace('_',' ')}</option>
          )}
        </select>
        <button type="submit" className="btn btn-secondary">Filter</button>
      </form>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Trip #</th><th>Vehicle</th><th>Driver</th><th>Branch</th>
                <th>Planned Start</th><th>Priority</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(trips as any[]).map(t => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/operations/trips/${t.id}`} className="font-mono text-[12px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 hover:bg-gray-200">
                      {t.trip_number}
                    </Link>
                  </td>
                  <td className="text-[13px]">{t.vehicle?.vehicle_number ?? <span className="text-gray-400">—</span>}</td>
                  <td className="text-[13px]">{t.driver?.full_name ?? <span className="text-gray-400">—</span>}</td>
                  <td className="text-[13px]">{t.branch?.name ?? '—'}</td>
                  <td>
                    <div className="text-[12.5px]">{formatDate(t.planned_start, 'HH:mm')}</div>
                    <div className="text-[11px] text-gray-400">{formatDate(t.planned_start, 'dd MMM')}</div>
                  </td>
                  <td><span className={`badge ${priorityColour[t.priority]}`}>{t.priority}</span></td>
                  <td><span className={`badge ${tripStatusColour[t.status]}`}>{t.status.replace('_',' ')}</span></td>
                  <td className="flex gap-1.5">
                    <Link href={`/operations/trips/${t.id}`} className="btn btn-secondary btn-sm">View</Link>
                    {t.status === 'requested' && (
                      <Link href={`/operations/trips/${t.id}/assign`} className="btn btn-primary btn-sm">Assign</Link>
                    )}
                  </td>
                </tr>
              ))}
              {trips.length === 0 && (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">No trips found for {filterDate}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    
  )
}
