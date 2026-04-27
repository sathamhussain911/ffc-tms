import { createServerSupabaseClient } from '@/lib/supabase/server'
import { formatDate, vehicleStatusColour, tripStatusColour } from '@/lib/utils'
import Link from 'next/link'

export const revalidate = 30

const TIME_SLOTS = ['06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21']

export default async function DispatchPage({
  searchParams,
}: {
  searchParams: { date?: string }
}) {
  const supabase = createServerSupabaseClient()
  const today = searchParams.date ?? new Date().toISOString().split('T')[0]

  const [vehiclesRes, driversRes, tripsRes] = await Promise.all([
    supabase
      .from('vehicles')
      .select('id,vehicle_number,vehicle_type,make,model,status,branch:branches(name)')
      .neq('status','inactive')
      .is('deleted_at', null)
      .order('vehicle_number'),
    supabase
      .from('drivers')
      .select('id,full_name,duty_status,performance_score,branch:branches(name)')
      .eq('status','active')
      .order('full_name'),
    supabase
      .from('trips')
      .select('id,trip_number,status,priority,planned_start,planned_end,vehicle_id,driver_id,cargo_description,branch:branches(name),vehicles(vehicle_number),drivers(full_name)')
      .gte('planned_start', `${today}T00:00:00`)
      .lte('planned_start', `${today}T23:59:59`)
      .not('status','in','(cancelled)')
      .is('deleted_at', null),
  ])

  const vehicles = vehiclesRes.data ?? []
  const drivers = driversRes.data ?? []
  const trips = tripsRes.data ?? []

  const pending = trips.filter((t: any) => ['requested','approved'].includes(t.status))
  const assigned = trips.filter((t: any) => !['requested','approved','cancelled'].includes(t.status))

  const TRIP_COLOUR: Record<string, string> = {
    in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
    assigned:    'bg-sky-100 text-sky-800 border-sky-200',
    completed:   'bg-green-100 text-green-800 border-green-200',
    delayed:     'bg-amber-100 text-amber-800 border-amber-200',
  }

  function getTripsForVehicleAtHour(vehicleId: string, hour: number) {
    return assigned.filter((t: any) => {
      if (t.vehicle_id !== vehicleId) return false
      const start = new Date(t.planned_start)
      const end = t.planned_end ? new Date(t.planned_end) : new Date(start.getTime() + 4 * 3600000)
      return start.getHours() <= hour && end.getHours() > hour
    })
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dispatch Planning Board</h1>
          <p className="page-subtitle">Daily vehicle & driver assignment — {formatDate(today, 'EEEE dd MMM yyyy')}</p>
        </div>
        <div className="flex gap-2 items-center">
          <form method="GET">
            <input
              name="date" type="date" defaultValue={today}
              className="form-control h-9 w-auto"
            />
          </form>
          <Link href="/operations/trips/new" className="btn btn-primary">+ New Trip</Link>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Available Vehicles', value: vehicles.filter((v:any)=>v.status==='available').length, colour:'blue' },
          { label: 'Drivers On Duty',   value: drivers.filter((d:any)=>d.duty_status==='on_duty').length, colour:'amber' },
          { label: 'Trips Dispatched',  value: assigned.length, colour:'green' },
          { label: 'Pending Dispatch',  value: pending.length, colour: pending.length>0?'red':'green' },
        ].map((m,i)=>(
          <div key={i} className={`metric-card ${m.colour}`}>
            <span className="metric-label">{m.label}</span>
            <span className="metric-value">{m.value}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">

        {/* Pending requests */}
        <div className="xl:col-span-1 card">
          <div className="card-header">
            <span className="card-title">Pending Requests</span>
            {pending.length > 0 && <span className="badge bg-red-100 text-red-700">{pending.length}</span>}
          </div>
          <div className="divide-y divide-gray-100">
            {pending.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">All dispatched ✓</div>
            ) : (
              (pending as any[]).map(t => (
                <div key={t.id} className="p-3.5 hover:bg-gray-50">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-mono text-[12px] bg-gray-100 px-1.5 py-0.5 rounded">{t.trip_number}</span>
                    <span className={`badge ${tripStatusColour[t.status]}`}>{t.status}</span>
                  </div>
                  <div className="text-[12.5px] text-gray-600 mb-1">{t.branch?.name}</div>
                  <div className="text-[12px] text-gray-400 mb-2">{formatDate(t.planned_start,'HH:mm')} · {t.cargo_description?.slice(0,25) ?? '—'}</div>
                  <Link href={`/operations/trips/${t.id}/assign`} className="btn btn-primary btn-sm w-full justify-center">
                    Assign →
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="xl:col-span-3 card overflow-x-auto">
          <div className="card-header">
            <span className="card-title">Vehicle Timeline — 06:00 to 22:00</span>
            <span className="text-[12px] text-gray-400">Refreshes every 30s</span>
          </div>
          <div style={{ minWidth: 900 }}>
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left font-bold text-gray-500 border border-gray-200 w-44">Vehicle</th>
                  {TIME_SLOTS.map(h => (
                    <th key={h} className="px-1 py-2 font-bold text-gray-400 border border-gray-200 text-center w-12">{h}:00</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(vehicles as any[]).map(v => (
                  <tr key={v.id}>
                    <td className="px-3 py-2 border border-gray-200 bg-gray-50">
                      <div className="font-semibold text-[12.5px]">{v.vehicle_number}</div>
                      <div className="text-[10.5px] text-gray-400">{v.make} {v.model}</div>
                      <span className={`badge mt-0.5 text-[10px] ${vehicleStatusColour[v.status]}`}>{v.status}</span>
                    </td>
                    {TIME_SLOTS.map(h => {
                      const hour = parseInt(h)
                      const hTrips = getTripsForVehicleAtHour(v.id, hour)
                      return (
                        <td key={h} className="border border-gray-200 p-0.5 align-top">
                          {hTrips.map((t: any) => (
                            <Link key={t.id} href={`/operations/trips/${t.id}`}>
                              <div className={`rounded p-1 text-[10px] font-semibold mb-0.5 border ${TRIP_COLOUR[t.status] ?? 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                <div>{t.trip_number}</div>
                                <div className="font-normal opacity-70">{(t.drivers?.full_name ?? '').split(' ')[0]}</div>
                              </div>
                            </Link>
                          ))}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {vehicles.length === 0 && (
                  <tr><td colSpan={TIME_SLOTS.length + 1} className="text-center py-10 text-gray-400">No vehicles found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Driver availability */}
      <div className="mt-5 card">
        <div className="card-header">
          <span className="card-title">Driver Availability</span>
          <span className="text-[12px] text-gray-400">{drivers.filter((d:any)=>d.duty_status==='on_duty').length} on duty · {drivers.filter((d:any)=>d.duty_status==='off_duty').length} off duty</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Driver</th><th>Branch</th><th>Duty Status</th><th>Performance Score</th><th>Today&apos;s Trips</th></tr>
            </thead>
            <tbody>
              {(drivers as any[]).map(d => {
                const dTrips = assigned.filter((t:any)=>t.driver_id===d.id)
                return (
                  <tr key={d.id}>
                    <td className="font-medium">{d.full_name}</td>
                    <td className="text-[13px]">{d.branch?.name ?? '—'}</td>
                    <td>
                      <span className={`badge ${
                        d.duty_status==='on_duty' ? 'bg-green-100 text-green-700'
                        : d.duty_status==='on_trip' ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-500'
                      }`}>
                        {d.duty_status.replace('_',' ')}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="progress-bar w-16">
                          <div className={`progress-fill ${(d.performance_score??0)>=80 ? 'bg-primary-500' : 'bg-amber-DEFAULT'}`}
                            style={{width:`${d.performance_score??0}%`}}/>
                        </div>
                        <span className="text-[12.5px] font-bold">{d.performance_score?.toFixed(0) ?? '—'}</span>
                      </div>
                    </td>
                    <td className="text-[13px]">
                      {dTrips.length > 0
                        ? (dTrips as any[]).map((t:any) => t.trip_number).join(', ')
                        : <span className="text-gray-400">None assigned</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
