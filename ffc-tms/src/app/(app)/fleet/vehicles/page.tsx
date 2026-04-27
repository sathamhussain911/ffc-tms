import { createServerSupabaseClient } from '@/lib/supabase/server'
import { formatDate, expiryStatus, expiryLabel, expiryStatusColour, vehicleStatusColour } from '@/lib/utils'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const revalidate = 30

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: { status?: string; branch?: string; q?: string }
}) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: user } = await supabase.from('users').select('*, role:roles(*), branch:branches(*)').eq('id', session.user.id).single()

  let query = supabase
    .from('vehicles')
    .select('*, branch:branches(name,code), current_driver:drivers(full_name)')
    .is('deleted_at', null)
    .order('vehicle_number')

  if (searchParams.status) query = query.eq('status', searchParams.status)
  if (searchParams.branch) query = query.eq('branch_id', searchParams.branch)
  if (searchParams.q) query = query.ilike('vehicle_number', `%${searchParams.q}%`)

  const { data: vehicles = [] } = await query
  const { data: branches = [] } = await supabase.from('branches').select('id,name,code').eq('status', 'active').order('name')

  const stats = {
    total: vehicles.length,
    available: vehicles.filter((v: any) => v.status === 'available').length,
    maintenance: vehicles.filter((v: any) => v.status === 'maintenance').length,
    issues: vehicles.filter((v: any) => ['expired','critical'].includes(expiryStatus(v.mulkiya_expiry)) || ['expired','critical'].includes(expiryStatus(v.insurance_expiry))).length,
  }

  return (
    
      <div className="page-header">
        <div>
          <h1 className="page-title">Vehicle Master</h1>
          <p className="page-subtitle">Fleet inventory, compliance status & document tracking</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm">Export CSV</button>
          <Link href="/fleet/vehicles/new" className="btn btn-primary">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M12 4v16m8-8H4"/></svg>
            Add Vehicle
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total Fleet', value: stats.total, colour: 'green' },
          { label: 'Available', value: stats.available, colour: 'green' },
          { label: 'In Maintenance', value: stats.maintenance, colour: 'amber' },
          { label: 'Doc Issues', value: stats.issues, colour: stats.issues > 0 ? 'red' : 'green' },
        ].map((s, i) => (
          <div key={i} className={`metric-card ${s.colour}`}>
            <span className="metric-label">{s.label}</span>
            <span className="metric-value">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <form className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 h-9 flex-1 min-w-[200px] focus-within:border-primary-500">
          <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/></svg>
          <input name="q" type="text" placeholder="Search vehicle number…" defaultValue={searchParams.q} className="bg-transparent outline-none text-[13px] w-full text-gray-700"/>
        </div>
        <select name="status" defaultValue={searchParams.status} className="form-control h-9 w-auto">
          <option value="">All Statuses</option>
          <option value="available">Available</option>
          <option value="assigned">Assigned</option>
          <option value="maintenance">Maintenance</option>
          <option value="inactive">Inactive</option>
        </select>
        <select name="branch" defaultValue={searchParams.branch} className="form-control h-9 w-auto">
          <option value="">All Branches</option>
          {(branches as any[]).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button type="submit" className="btn btn-secondary">Filter</button>
      </form>

      {/* Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Vehicle #</th>
                <th>Type / Make</th>
                <th>Branch</th>
                <th>Driver</th>
                <th>Status</th>
                <th>Mulkiya Expiry</th>
                <th>Insurance</th>
                <th>Odometer</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(vehicles as any[]).map(v => {
                const mSt = expiryStatus(v.mulkiya_expiry)
                const iSt = expiryStatus(v.insurance_expiry)
                return (
                  <tr key={v.id}>
                    <td>
                      <Link href={`/fleet/vehicles/${v.id}`} className="font-semibold text-primary-700 hover:underline">
                        {v.vehicle_number}
                      </Link>
                    </td>
                    <td>
                      <div className="font-medium capitalize">{v.vehicle_type.replace('_', ' ')}</div>
                      <div className="text-[11.5px] text-gray-400">{v.make} {v.model}</div>
                    </td>
                    <td className="text-[13px]">{v.branch?.name ?? '—'}</td>
                    <td className="text-[13px]">{v.current_driver?.full_name ?? <span className="text-gray-400">Unassigned</span>}</td>
                    <td>
                      <span className={`badge ${vehicleStatusColour[v.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {v.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${expiryStatusColour[mSt]}`}>
                        {expiryLabel(v.mulkiya_expiry)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${expiryStatusColour[iSt]}`}>
                        {expiryLabel(v.insurance_expiry)}
                      </span>
                    </td>
                    <td className="font-mono text-[12px] text-gray-500">{v.current_odometer?.toLocaleString()} km</td>
                    <td>
                      <Link href={`/fleet/vehicles/${v.id}`} className="btn btn-secondary btn-sm">View</Link>
                    </td>
                  </tr>
                )
              })}
              {vehicles.length === 0 && (
                <tr><td colSpan={9} className="text-center py-10 text-gray-400">No vehicles found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    
  )
}
