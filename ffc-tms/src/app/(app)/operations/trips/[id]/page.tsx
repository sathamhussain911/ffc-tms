import { createServerSupabaseClient } from '@/lib/supabase/server'
import { formatDate, formatDateTime, tripStatusColour, priorityColour } from '@/lib/utils'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const revalidate = 15

export default async function TripDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()

  const { data: trip } = await supabase
    .from('trips')
    .select(`
      *,
      branch:branches(name),
      vehicle:vehicles(id,vehicle_number,make,model,vehicle_type),
      driver:drivers(id,full_name,mobile,employee_id),
      requester:users(full_name),
      stops:trip_stops(*),
      events:trip_events(*, actor:users(full_name))
    `)
    .eq('id', params.id)
    .is('deleted_at', null)
    .single()

  if (!trip) notFound()

  const canAssign = ['requested','approved'].includes(trip.status)
  const canStart  = trip.status === 'assigned'
  const canCancel = !['completed','cancelled'].includes(trip.status)

  const stops = ((trip as any).stops ?? []).sort((a: any, b: any) => a.sequence - b.sequence)
  const events = ((trip as any).events ?? []).sort((a: any, b: any) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())

  const STOP_STATUS: Record<string, string> = {
    delivered: 'bg-green-100 text-green-700',
    pending:   'bg-gray-100 text-gray-500',
    partial:   'bg-amber-100 text-amber-700',
    failed:    'bg-red-100 text-red-700',
  }

  const EVENT_DOT: Record<string, string> = {
    status_change: 'bg-blue-500',
    assignment:    'bg-primary-500',
    note:          'bg-gray-400',
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/operations/trips" className="text-gray-400 hover:text-gray-600 text-sm">← Trips</Link>
          <div>
            <h1 className="page-title">{trip.trip_number}</h1>
            <p className="page-subtitle">{(trip as any).branch?.name} · Created {formatDate(trip.created_at)}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canAssign && <Link href={`/operations/trips/${params.id}/assign`} className="btn btn-primary">Assign Vehicle & Driver</Link>}
          {canCancel && <button className="btn btn-danger btn-sm">Cancel Trip</button>}
          <span className={`badge ${tripStatusColour[trip.status]} text-[13px] px-4`}>{trip.status.replace('_',' ')}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        <div className="xl:col-span-2 space-y-5">

          {/* Trip header details */}
          <div className="card">
            <div className="card-header"><span className="card-title">Trip Details</span></div>
            <div className="card-body grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label:'Trip Number',    value: trip.trip_number },
                { label:'Branch',         value: (trip as any).branch?.name },
                { label:'Priority',       value: <span className={`badge ${priorityColour[trip.priority]}`}>{trip.priority}</span> },
                { label:'Planned Start',  value: formatDateTime(trip.planned_start) },
                { label:'Planned End',    value: formatDateTime(trip.planned_end) },
                { label:'Actual Start',   value: formatDateTime(trip.actual_start) },
                { label:'Actual End',     value: formatDateTime(trip.actual_end) },
                { label:'Vehicle',        value: (trip as any).vehicle ? `${(trip as any).vehicle.vehicle_number} — ${(trip as any).vehicle.make}` : '—' },
                { label:'Driver',         value: (trip as any).driver?.full_name },
                { label:'Requested By',   value: (trip as any).requester?.full_name },
                { label:'Opening Odo.',   value: trip.opening_odometer ? `${trip.opening_odometer.toLocaleString()} km` : '—' },
                { label:'Closing Odo.',   value: trip.closing_odometer ? `${trip.closing_odometer.toLocaleString()} km` : '—' },
                { label:'Total Distance', value: trip.total_distance ? `${trip.total_distance.toLocaleString()} km` : '—' },
                { label:'Cargo',          value: trip.cargo_description },
                { label:'Weight',         value: trip.cargo_weight_kg ? `${trip.cargo_weight_kg} kg` : '—' },
              ].map((f, i) => (
                <div key={i}>
                  <div className="text-[11.5px] text-gray-400 font-medium uppercase tracking-wide">{f.label}</div>
                  <div className="text-[13.5px] font-semibold text-gray-800 mt-0.5">{f.value ?? <span className="text-gray-300">—</span>}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery stops */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Delivery Stops</span>
              <span className="text-[12px] text-gray-400">{stops.filter((s:any)=>s.delivery_status==='delivered').length}/{stops.length} delivered</span>
            </div>
            <div className="divide-y divide-gray-100">
              {stops.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">No stops added</div>
              ) : (
                stops.map((stop: any, i: number) => (
                  <div key={stop.id} className="p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${stop.delivery_status==='delivered'?'bg-green-500 text-white':'bg-gray-200 text-gray-600'}`}>
                          {stop.delivery_status==='delivered' ? '✓' : i+1}
                        </div>
                        <span className="font-semibold text-[14px]">{stop.destination_name}</span>
                      </div>
                      <span className={`badge ${STOP_STATUS[stop.delivery_status]}`}>{stop.delivery_status}</span>
                    </div>
                    {stop.address && <div className="text-[12.5px] text-gray-500 ml-9">{stop.address}</div>}
                    <div className="flex gap-4 mt-1 ml-9 text-[12px] text-gray-400 flex-wrap">
                      {stop.contact_name && <span>👤 {stop.contact_name} {stop.contact_phone}</span>}
                      {stop.expected_arrival && <span>🕐 ETA {formatDate(stop.expected_arrival,'HH:mm')}</span>}
                      {stop.actual_arrival && <span>✅ Arrived {formatDate(stop.actual_arrival,'HH:mm')}</span>}
                    </div>
                    {stop.notes && <div className="text-[12px] text-gray-500 ml-9 mt-1 italic">{stop.notes}</div>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Event timeline */}
        <div className="card">
          <div className="card-header"><span className="card-title">Activity Timeline</span></div>
          <div className="card-body">
            {events.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">No events recorded</div>
            ) : (
              <div className="space-y-0">
                {events.map((ev: any, i: number) => (
                  <div key={ev.id} className="flex gap-3 pb-4 relative">
                    {i < events.length - 1 && (
                      <div className="absolute left-[8.5px] top-5 bottom-0 w-px bg-gray-200"/>
                    )}
                    <div className={`w-4 h-4 rounded-full flex-shrink-0 mt-1 z-10 ${EVENT_DOT[ev.event_type] ?? 'bg-gray-300'}`}/>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-mono text-gray-400">{formatDate(ev.occurred_at,'dd MMM HH:mm')}</div>
                      <div className="text-[13px] text-gray-700 mt-0.5">
                        {ev.event_type === 'status_change' && (
                          <><span className="font-semibold capitalize">{ev.to_status?.replace('_',' ')}</span>{ev.from_status && ` ← ${ev.from_status.replace('_',' ')}`}</>
                        )}
                        {ev.event_type !== 'status_change' && <span className="capitalize">{ev.event_type}</span>}
                      </div>
                      {ev.actor?.full_name && <div className="text-[11.5px] text-gray-400">by {ev.actor.full_name}</div>}
                      {ev.notes && <div className="text-[12px] text-gray-500 mt-0.5 italic">{ev.notes}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
