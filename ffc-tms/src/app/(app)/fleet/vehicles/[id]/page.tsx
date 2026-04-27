import { createServerSupabaseClient } from '@/lib/supabase/server'
import { formatDate, expiryStatus, expiryLabel, expiryStatusColour, vehicleStatusColour, tripStatusColour } from '@/lib/utils'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const revalidate = 30

export default async function VehicleDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('*, branch:branches(*), current_driver:drivers(id,full_name,employee_id,mobile), vendor:vendors(name)')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single()

  if (!vehicle) notFound()

  const { data: docs } = await supabase
    .from('vehicle_documents')
    .select('*')
    .eq('vehicle_id', params.id)
    .order('created_at', { ascending: false })

  const { data: trips } = await supabase
    .from('trips')
    .select('id,trip_number,status,planned_start,actual_end,driver:drivers(full_name)')
    .eq('vehicle_id', params.id)
    .is('deleted_at', null)
    .order('planned_start', { ascending: false })
    .limit(10)

  const compliance = [
    { label: 'Mulkiya', expiry: vehicle.mulkiya_expiry, number: vehicle.mulkiya_number },
    { label: 'Insurance', expiry: vehicle.insurance_expiry, number: vehicle.insurance_policy },
    { label: 'GPS Contract', expiry: vehicle.gps_contract_expiry, number: vehicle.gps_device_id },
  ]

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/fleet/vehicles" className="text-gray-400 hover:text-gray-600 text-sm">← Vehicles</Link>
          <div>
            <h1 className="page-title">{vehicle.vehicle_number}</h1>
            <p className="page-subtitle">{vehicle.make} {vehicle.model} · {vehicle.year} · {vehicle.vehicle_type.replace('_',' ')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/fleet/vehicles/${params.id}/edit`} className="btn btn-secondary">Edit Vehicle</Link>
          <span className={`badge ${vehicleStatusColour[vehicle.status]} text-[13px] px-4`}>
            {vehicle.status.replace('_',' ')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Overview */}
        <div className="xl:col-span-2 space-y-5">

          {/* Details card */}
          <div className="card">
            <div className="card-header"><span className="card-title">Vehicle Details</span></div>
            <div className="card-body grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label:'Registration', value: vehicle.vehicle_number },
                { label:'Internal Code', value: vehicle.vehicle_code },
                { label:'Type', value: vehicle.vehicle_type?.replace('_',' ') },
                { label:'Make', value: vehicle.make },
                { label:'Model', value: vehicle.model },
                { label:'Year', value: vehicle.year },
                { label:'Capacity', value: vehicle.capacity_kg ? `${vehicle.capacity_kg} kg` : '—' },
                { label:'Ownership', value: vehicle.ownership_type },
                { label:'Branch', value: (vehicle as any).branch?.name },
                { label:'VIN / Chassis', value: vehicle.vin },
                { label:'Engine #', value: vehicle.engine_number },
                { label:'Odometer', value: vehicle.current_odometer ? `${vehicle.current_odometer.toLocaleString()} km` : '—' },
                { label:'Salik Tag', value: vehicle.salik_tag },
                { label:'Color', value: vehicle.color },
                { label:'Vendor', value: (vehicle as any).vendor?.name },
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
              <Link href={`/operations/trips?vehicle=${params.id}`} className="btn btn-ghost btn-sm">All trips →</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Trip #</th><th>Driver</th><th>Date</th><th>Status</th></tr></thead>
                <tbody>
                  {(trips ?? []).map((t:any) => (
                    <tr key={t.id}>
                      <td><Link href={`/operations/trips/${t.id}`} className="font-mono text-[12px] bg-gray-100 px-1.5 py-0.5 rounded hover:bg-gray-200">{t.trip_number}</Link></td>
                      <td>{t.driver?.full_name ?? '—'}</td>
                      <td className="font-mono text-[12px] text-gray-500">{formatDate(t.planned_start)}</td>
                      <td><span className={`badge ${tripStatusColour[t.status]}`}>{t.status.replace('_',' ')}</span></td>
                    </tr>
                  ))}
                  {(trips ?? []).length === 0 && <tr><td colSpan={4} className="text-center py-6 text-gray-400">No trip history</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">

          {/* Assigned driver */}
          <div className="card">
            <div className="card-header"><span className="card-title">Assigned Driver</span></div>
            <div className="card-body">
              {(vehicle as any).current_driver ? (
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center font-bold text-primary-700">
                      {(vehicle as any).current_driver.full_name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{(vehicle as any).current_driver.full_name}</div>
                      <div className="text-[12px] text-gray-400">{(vehicle as any).current_driver.employee_id}</div>
                    </div>
                  </div>
                  <Link href={`/fleet/drivers/${(vehicle as any).current_driver.id}`} className="btn btn-secondary btn-sm w-full justify-center">
                    View Driver →
                  </Link>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-400 text-sm">No driver assigned</div>
              )}
            </div>
          </div>

          {/* Compliance status */}
          <div className="card">
            <div className="card-header"><span className="card-title">Compliance Status</span></div>
            <div className="card-body space-y-3">
              {compliance.map((c, i) => {
                const st = expiryStatus(c.expiry)
                return (
                  <div key={i} className={`rounded-lg p-3 border ${st==='expired'?'bg-red-50 border-red-200':st==='critical'?'bg-amber-50 border-amber-200':st==='warning'?'bg-yellow-50 border-yellow-100':'bg-green-50 border-green-200'}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-[13px] text-gray-800">{c.label}</span>
                      <span className={`badge ${expiryStatusColour[st]}`}>{expiryLabel(c.expiry)}</span>
                    </div>
                    {c.number && <div className="font-mono text-[11.5px] text-gray-500">{c.number}</div>}
                    <div className="text-[11.5px] text-gray-400 mt-0.5">Expires: {formatDate(c.expiry)}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Documents */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Uploaded Documents</span>
            </div>
            <div className="card-body space-y-2">
              {(docs ?? []).length === 0 ? (
                <div className="text-center py-4 text-gray-400 text-sm">No documents uploaded</div>
              ) : (
                (docs ?? []).map((d:any) => (
                  <div key={d.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div>
                      <div className="text-[13px] font-medium capitalize">{d.doc_type.replace('_',' ')}</div>
                      <div className="text-[11px] text-gray-400">{formatDate(d.expiry_date)}</div>
                    </div>
                    {d.file_path && (
                      <span className="text-[12px] text-primary-700 font-medium">📎 View</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
