import { createServerSupabaseClient } from '@/lib/supabase/server'
import { formatDate, expiryStatus, expiryLabel, expiryStatusColour, driverStatusColour, tripStatusColour } from '@/lib/utils'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const revalidate = 30

export default async function DriverDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()

  const { data: driver } = await supabase
    .from('drivers')
    .select('*, branch:branches(*)')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single()

  if (!driver) notFound()

  const { data: trips } = await supabase
    .from('trips')
    .select('id,trip_number,status,planned_start,vehicle:vehicles(vehicle_number)')
    .eq('driver_id', params.id)
    .is('deleted_at', null)
    .order('planned_start', { ascending: false })
    .limit(10)

  const { data: currentVehicle } = await supabase
    .from('vehicles')
    .select('id,vehicle_number,make,model,vehicle_type')
    .eq('current_driver_id', params.id)
    .is('deleted_at', null)
    .maybeSingle()

  const docs = [
    { label: 'Emirates ID', expiry: driver.eid_expiry, number: driver.eid_number },
    { label: 'Driving License', expiry: driver.license_expiry, number: driver.license_number, sub: driver.license_class ? `Class: ${driver.license_class}` : null },
    { label: 'Passport', expiry: driver.passport_expiry, number: driver.passport_number },
  ]

  const completedTrips = trips?.filter(t => t.status === 'completed') ?? []
  const onTimeTrips = completedTrips.length // simplified — full calc needs actual vs planned

  // Performance score breakdown (Phase 1 rule-based)
  const score = driver.performance_score ?? 0
  const scoreColour = score >= 80 ? 'text-primary-700' : score >= 60 ? 'text-amber-600' : 'text-red-600'

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/fleet/drivers" className="text-gray-400 hover:text-gray-600 text-sm">← Drivers</Link>
          <div>
            <h1 className="page-title">{driver.full_name}</h1>
            <p className="page-subtitle">{driver.driver_code} · {driver.employee_id ?? 'No employee ID'} · {(driver as any).branch?.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/fleet/drivers/${params.id}/edit`} className="btn btn-secondary">Edit Driver</Link>
          <span className={`badge ${driverStatusColour[driver.status]} text-[13px] px-4`}>
            {driver.status.replace('_',' ')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        <div className="xl:col-span-2 space-y-5">

          {/* Driver info */}
          <div className="card">
            <div className="card-header"><span className="card-title">Driver Information</span></div>
            <div className="card-body grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label:'Full Name',        value: driver.full_name },
                { label:'Employee ID',      value: driver.employee_id },
                { label:'Driver Code',      value: driver.driver_code },
                { label:'Mobile',           value: driver.mobile },
                { label:'Alt Mobile',       value: driver.alternate_mobile },
                { label:'Email',            value: driver.email },
                { label:'Nationality',      value: driver.nationality },
                { label:'Date of Birth',    value: formatDate(driver.date_of_birth) },
                { label:'Employment Type',  value: driver.employment_type },
                { label:'Branch',           value: (driver as any).branch?.name },
                { label:'Joining Date',     value: formatDate(driver.joining_date) },
                { label:'Duty Status',      value: driver.duty_status?.replace('_',' ') },
              ].map((f,i) => (
                <div key={i}>
                  <div className="text-[11.5px] text-gray-400 font-medium uppercase tracking-wide">{f.label}</div>
                  <div className="text-[13.5px] font-semibold text-gray-800 mt-0.5">{f.value ?? <span className="text-gray-300">—</span>}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Trip history */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Recent Trips</span>
              <span className="text-[12px] text-gray-400">{trips?.length ?? 0} trips loaded</span>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Trip #</th><th>Vehicle</th><th>Date</th><th>Status</th></tr></thead>
                <tbody>
                  {(trips ?? []).map((t:any) => (
                    <tr key={t.id}>
                      <td><Link href={`/operations/trips/${t.id}`} className="font-mono text-[12px] bg-gray-100 px-1.5 py-0.5 rounded hover:bg-gray-200">{t.trip_number}</Link></td>
                      <td className="text-[13px]">{t.vehicle?.vehicle_number ?? '—'}</td>
                      <td className="font-mono text-[12px] text-gray-500">{formatDate(t.planned_start)}</td>
                      <td><span className={`badge ${tripStatusColour[t.status]}`}>{t.status.replace('_',' ')}</span></td>
                    </tr>
                  ))}
                  {(trips ?? []).length === 0 && <tr><td colSpan={4} className="text-center py-6 text-gray-400">No trips yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">

          {/* Performance score */}
          <div className="card">
            <div className="card-header"><span className="card-title">Performance Score</span></div>
            <div className="card-body text-center">
              <div className={`text-[56px] font-extrabold leading-none ${scoreColour}`}>{score.toFixed(0)}</div>
              <div className="text-gray-400 text-sm mb-4">out of 100 · Target ≥ 80</div>
              <div className="progress-bar h-3 mb-5">
                <div className={`progress-fill h-full ${score>=80?'bg-primary-500':score>=60?'bg-amber-DEFAULT':'bg-red-500'}`} style={{width:`${score}%`}}/>
              </div>
              <div className="space-y-2 text-left">
                {[
                  { label:'On-Time Rate', weight:'40%', value: completedTrips.length > 0 ? `${Math.round((onTimeTrips/completedTrips.length)*100)}%` : '—' },
                  { label:'Completion Rate', weight:'20%', value: '—' },
                  { label:'Fine Incidence', weight:'15%', value: '—' },
                  { label:'Accident Record', weight:'15%', value: '—' },
                  { label:'Doc Compliance', weight:'10%', value: '—' },
                ].map((row,i) => (
                  <div key={i} className="flex justify-between items-center text-[12.5px]">
                    <span className="text-gray-600">{row.label}</span>
                    <span className="text-gray-400 text-[11px]">{row.weight}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="card">
            <div className="card-header"><span className="card-title">Document Status</span></div>
            <div className="card-body space-y-3">
              {docs.map((d, i) => {
                const st = expiryStatus(d.expiry)
                return (
                  <div key={i} className={`rounded-lg p-3 border ${st==='expired'?'bg-red-50 border-red-200':st==='critical'?'bg-amber-50 border-amber-200':st==='warning'?'bg-yellow-50 border-yellow-100':'bg-green-50 border-green-200'}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-[13px] text-gray-800">{d.label}</span>
                      <span className={`badge ${expiryStatusColour[st]}`}>{expiryLabel(d.expiry)}</span>
                    </div>
                    {d.number && <div className="font-mono text-[11.5px] text-gray-500">{d.number}</div>}
                    {'sub' in d && d.sub && <div className="text-[11px] text-gray-400">{d.sub}</div>}
                    <div className="text-[11px] text-gray-400 mt-0.5">Expiry: {formatDate(d.expiry)}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Current vehicle */}
          {currentVehicle && (
            <div className="card">
              <div className="card-header"><span className="card-title">Current Vehicle</span></div>
              <div className="card-body">
                <div className="font-bold text-primary-700 text-[15px]">{currentVehicle.vehicle_number}</div>
                <div className="text-[13px] text-gray-500">{currentVehicle.make} {currentVehicle.model}</div>
                <Link href={`/fleet/vehicles/${currentVehicle.id}`} className="btn btn-secondary btn-sm mt-3 w-full justify-center">View Vehicle →</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
