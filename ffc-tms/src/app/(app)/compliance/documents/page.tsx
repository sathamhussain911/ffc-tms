import { createServerSupabaseClient } from '@/lib/supabase/server'
import { formatDate, expiryStatus, expiryLabel, expiryStatusColour } from '@/lib/utils'
import Link from 'next/link'

export const revalidate = 60

export default async function DocumentsPage() {
  const supabase = createServerSupabaseClient()

  const [vehiclesRes, driversRes] = await Promise.all([
    supabase.from('vehicles')
      .select('id,vehicle_number,mulkiya_expiry,insurance_expiry,gps_contract_expiry,branch:branches(name)')
      .is('deleted_at', null).neq('status','inactive').order('vehicle_number'),
    supabase.from('drivers')
      .select('id,full_name,employee_id,eid_expiry,license_expiry,passport_expiry')
      .eq('status','active').is('deleted_at', null).order('full_name'),
  ])

  const vehicles = vehiclesRes.data ?? []
  const drivers = driversRes.data ?? []

  type DocRow = {
    id: string; entity: string; entityType: 'vehicle'|'driver'
    docType: string; expiry: string|null; status: string; href: string
  }

  const docs: DocRow[] = [
    ...(vehicles as any[]).flatMap(v => [
      { id:`${v.id}-m`, entity:v.vehicle_number, entityType:'vehicle' as const, docType:'Mulkiya', expiry:v.mulkiya_expiry, status:expiryStatus(v.mulkiya_expiry), href:`/fleet/vehicles/${v.id}` },
      { id:`${v.id}-i`, entity:v.vehicle_number, entityType:'vehicle' as const, docType:'Insurance', expiry:v.insurance_expiry, status:expiryStatus(v.insurance_expiry), href:`/fleet/vehicles/${v.id}` },
      ...(v.gps_contract_expiry ? [{ id:`${v.id}-g`, entity:v.vehicle_number, entityType:'vehicle' as const, docType:'GPS Contract', expiry:v.gps_contract_expiry, status:expiryStatus(v.gps_contract_expiry), href:`/fleet/vehicles/${v.id}` }] : []),
    ]),
    ...(drivers as any[]).flatMap(d => [
      { id:`${d.id}-e`, entity:d.full_name, entityType:'driver' as const, docType:'Emirates ID', expiry:d.eid_expiry, status:expiryStatus(d.eid_expiry), href:`/fleet/drivers/${d.id}` },
      { id:`${d.id}-l`, entity:d.full_name, entityType:'driver' as const, docType:'Driving License', expiry:d.license_expiry, status:expiryStatus(d.license_expiry), href:`/fleet/drivers/${d.id}` },
      ...(d.passport_expiry ? [{ id:`${d.id}-p`, entity:d.full_name, entityType:'driver' as const, docType:'Passport', expiry:d.passport_expiry, status:expiryStatus(d.passport_expiry), href:`/fleet/drivers/${d.id}` }] : []),
    ]),
  ]

  const ORDER = { expired:0, critical:1, warning:2, ok:3, unknown:4 }
  const sorted = docs.sort((a,b) => (ORDER[a.status as keyof typeof ORDER]??4) - (ORDER[b.status as keyof typeof ORDER]??4))

  const expired = sorted.filter(d=>d.status==='expired').length
  const critical = sorted.filter(d=>d.status==='critical').length
  const warning  = sorted.filter(d=>d.status==='warning').length
  const ok       = sorted.filter(d=>d.status==='ok').length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Documents & Expiry</h1>
          <p className="page-subtitle">Mulkiya · Insurance · Emirates ID · Driving License · GPS Contracts</p>
        </div>
      </div>

      {(expired > 0 || critical > 0) && (
        <div className="alert alert-red mb-5">
          <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4"/>
          </svg>
          <p className="text-sm text-red-700">
            <strong>{expired} expired</strong> and <strong>{critical} expiring within 7 days</strong>.
            Expired vehicle documents auto-block new trip assignments.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {[
          { label:'Expired',       value:expired,  colour:'red' },
          { label:'Critical ≤7d',  value:critical, colour:'amber' },
          { label:'Warning ≤30d',  value:warning,  colour:'blue' },
          { label:'Valid',         value:ok,        colour:'green' },
        ].map((s,i) => (
          <div key={i} className={`metric-card ${s.colour}`}>
            <span className="metric-label">{s.label}</span>
            <span className="metric-value">{s.value}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Entity</th><th>Type</th><th>Document</th>
                <th>Expiry Date</th><th>Status</th><th>Days Left</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(doc => (
                <tr key={doc.id} className={doc.status==='expired'?'bg-red-50':doc.status==='critical'?'bg-amber-50':''}>
                  <td>
                    <Link href={doc.href} className="font-semibold text-primary-700 hover:underline">
                      {doc.entity}
                    </Link>
                    <div className="text-[11px] text-gray-400 capitalize">{doc.entityType}</div>
                  </td>
                  <td>
                    <span className={`badge ${doc.entityType==='vehicle'?'bg-blue-100 text-blue-700':'bg-purple-100 text-purple-700'}`}>
                      {doc.entityType}
                    </span>
                  </td>
                  <td className="font-medium text-[13px]">{doc.docType}</td>
                  <td className="font-mono text-[12.5px]">{formatDate(doc.expiry)}</td>
                  <td><span className={`badge ${expiryStatusColour[doc.status]}`}>{doc.status.toUpperCase()}</span></td>
                  <td className={`font-mono text-[13px] font-bold ${
                    doc.status==='expired'?'text-red-600':doc.status==='critical'?'text-amber-600':'text-gray-600'
                  }`}>
                    {expiryLabel(doc.expiry)}
                  </td>
                  <td>
                    {doc.status !== 'ok' && doc.status !== 'unknown'
                      ? <Link href={doc.href} className="btn btn-primary btn-sm">Update</Link>
                      : <Link href={doc.href} className="btn btn-secondary btn-sm">View</Link>
                    }
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">No documents found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
