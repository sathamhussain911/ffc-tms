import { createServerSupabaseClient } from '@/lib/supabase/server'
import { formatDate, expiryStatus, expiryLabel, expiryStatusColour, tripStatusColour } from '@/lib/utils'
import Link from 'next/link'

export const revalidate = 60

async function getDashboardData() {
  const supabase = createServerSupabaseClient()
  const today = new Date().toISOString().split('T')[0]

  const [vehicles, drivers, trips] = await Promise.all([
    supabase.from('vehicles').select('id,status,mulkiya_expiry,insurance_expiry').is('deleted_at', null),
    supabase.from('drivers').select('id,status,performance_score').is('deleted_at', null),
    supabase.from('trips').select(`
      id, trip_number, status, planned_start, actual_end,
      branch:branches(name),
      vehicle:vehicles(vehicle_number),
      driver:drivers(full_name)
    `).gte('planned_start', `${today}T00:00:00`).lte('planned_start', `${today}T23:59:59`).is('deleted_at', null).order('planned_start'),
  ])

  return {
    vehicles: vehicles.data ?? [],
    drivers: drivers.data ?? [],
    trips: trips.data ?? [],
  }
}

export default async function DashboardPage() {
  const { vehicles, drivers, trips } = await getDashboardData()

  const active = vehicles.filter((v: any) => v.status !== 'inactive')
  const available = vehicles.filter((v: any) => v.status === 'available')
  const maintenance = vehicles.filter((v: any) => v.status === 'maintenance')
  const fleetAvail = active.length > 0 ? Math.round((available.length / active.length) * 100) : 0

  const activeDrivers = drivers.filter((d: any) => d.status === 'active')
  const completedTrips = trips.filter((t: any) => t.status === 'completed')
  const inProgress = trips.filter((t: any) => t.status === 'in_progress')
  const avgScore = activeDrivers.length > 0
    ? activeDrivers.filter((d: any) => d.performance_score != null).reduce((acc: number, d: any, _: any, arr: any[]) => acc + d.performance_score / arr.length, 0)
    : 0

  const criticalVehicles = vehicles.filter((v: any) =>
    ['expired', 'critical'].includes(expiryStatus(v.mulkiya_expiry)) ||
    ['expired', 'critical'].includes(expiryStatus(v.insurance_expiry))
  )

  const metrics = [
    { label: 'Total Vehicles', value: vehicles.length, sub: `${available.length} available · ${maintenance.length} maintenance`, colour: 'green' },
    { label: 'Fleet Availability', value: `${fleetAvail}%`, sub: 'Target ≥ 85%', colour: fleetAvail >= 85 ? 'green' : 'red', bar: fleetAvail },
    { label: "Today's Trips", value: trips.length, sub: `${completedTrips.length} done · ${inProgress.length} active`, colour: 'blue' },
    { label: 'Active Drivers', value: activeDrivers.length, sub: `Avg score: ${avgScore.toFixed(0)}`, colour: 'amber' },
    { label: 'Doc Alerts', value: criticalVehicles.length, sub: 'Expired / ≤7 days', colour: criticalVehicles.length > 0 ? 'red' : 'green' },
    { label: 'Dispatched Today', value: trips.filter((t: any) => t.status !== 'requested').length, sub: `${trips.filter((t: any) => t.status === 'requested').length} pending assign`, colour: 'teal' },
  ]

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Operations Dashboard</h1>
          <p className="page-subtitle">
            Live overview — {new Date().toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Link href="/operations/trips/new" className="btn btn-primary">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" d="M12 4v16m8-8H4"/>
          </svg>
          New Trip
        </Link>
      </div>

      {/* Critical alerts */}
      {criticalVehicles.length > 0 && (
        <div className="alert alert-red mb-5">
          <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <p className="text-sm text-red-700">
            <strong>{criticalVehicles.length} vehicle document{criticalVehicles.length > 1 ? 's' : ''} expired or expiring within 7 days.</strong>{' '}
            <Link href="/compliance/documents" className="underline font-semibold">Review now →</Link>
          </p>
        </div>
      )}

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {metrics.map((m, i) => (
          <div key={i} className={`metric-card ${m.colour}`} style={{ animationDelay: `${i * 0.06}s` }}>
            <span className="metric-label">{m.label}</span>
            <span className="metric-value">{m.value}</span>
            {m.bar !== undefined && (
              <div className="progress-bar">
                <div
                  className={`progress-fill ${m.bar >= 85 ? 'bg-primary-500' : m.bar >= 70 ? 'bg-amber-DEFAULT' : 'bg-red-500'}`}
                  style={{ width: `${m.bar}%` }}
                />
              </div>
            )}
            <p className="text-[12px] text-gray-400">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

        {/* Today's trips */}
        <div className="xl:col-span-3 card">
          <div className="card-header">
            <span className="card-title">Today&apos;s Trip Activity</span>
            <Link href="/operations/trips" className="btn btn-ghost btn-sm">View All →</Link>
          </div>
          <div className="overflow-x-auto">
            {trips.length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-sm">No trips scheduled for today</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>Trip #</th><th>Vehicle</th><th>Driver</th><th>Branch</th><th>Time</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {(trips as any[]).slice(0, 10).map(t => (
                    <tr key={t.id}>
                      <td>
                        <Link href={`/operations/trips/${t.id}`} className="font-mono text-[12px] bg-gray-100 px-1.5 py-0.5 rounded hover:bg-gray-200">
                          {t.trip_number}
                        </Link>
                      </td>
                      <td className="text-[13px]">{t.vehicle?.vehicle_number ?? <span className="text-gray-400">—</span>}</td>
                      <td className="text-[13px]">{t.driver?.full_name ?? <span className="text-gray-400">Unassigned</span>}</td>
                      <td className="text-[13px]">{t.branch?.name ?? '—'}</td>
                      <td className="font-mono text-[12px] text-gray-500">{formatDate(t.planned_start, 'HH:mm')}</td>
                      <td><span className={`badge ${tripStatusColour[t.status] ?? 'bg-gray-100 text-gray-500'}`}>{t.status.replace('_', ' ')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Document expiry */}
        <div className="xl:col-span-2 card">
          <div className="card-header">
            <span className="card-title">Document Expiry Monitor</span>
            <Link href="/compliance/documents" className="btn btn-ghost btn-sm">Manage →</Link>
          </div>
          <div className="card-body pt-3 space-y-3">
            {vehicles.slice(0, 6).map((v: any) => {
              const mSt = expiryStatus(v.mulkiya_expiry)
              const iSt = expiryStatus(v.insurance_expiry)
              if (mSt === 'ok' && iSt === 'ok') return null
              const worst = ['expired','critical','warning'].find(s => s === mSt || s === iSt)
              if (!worst) return null
              return (
                <div key={v.id} className={`rounded-lg p-3 border text-sm ${worst === 'expired' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className={`badge ${expiryStatusColour[worst]}`}>{worst.toUpperCase()}</span>
                    <span className="text-[12px] text-gray-500">Mulkiya: {expiryLabel(v.mulkiya_expiry)}</span>
                  </div>
                  <div className="text-[12px] text-gray-500">Insurance: {expiryLabel(v.insurance_expiry)}</div>
                </div>
              )
            }).filter(Boolean)}
            {criticalVehicles.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">
                <div className="text-2xl mb-1">✅</div>
                All documents valid
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick navigation cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
        {[
          { label: 'Vehicles', icon: '🚛', href: '/fleet/vehicles', count: vehicles.length, sub: 'Manage fleet' },
          { label: 'Drivers', icon: '👤', href: '/fleet/drivers', count: activeDrivers.length, sub: 'Active drivers' },
          { label: 'Dispatch Board', icon: '📅', href: '/operations/dispatch', count: null, sub: 'Plan today' },
          { label: 'Documents', icon: '📄', href: '/compliance/documents', count: criticalVehicles.length || null, sub: criticalVehicles.length > 0 ? `${criticalVehicles.length} need action` : 'All valid' },
        ].map((item, i) => (
          <Link key={i} href={item.href}>
            <div className="card p-4 hover:shadow-card-hover transition-shadow cursor-pointer">
              <div className="text-2xl mb-2">{item.icon}</div>
              <div className="font-bold text-[14px] text-gray-900">{item.label}</div>
              {item.count != null && <div className="text-[22px] font-extrabold text-primary-700">{item.count}</div>}
              <div className="text-[12px] text-gray-400 mt-0.5">{item.sub}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
