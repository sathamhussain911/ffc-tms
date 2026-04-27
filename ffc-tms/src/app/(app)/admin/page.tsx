import { createServerSupabaseClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'

export const revalidate = 60

export default async function AdminPage() {
  const supabase = createServerSupabaseClient()

  const [usersRes, branchesRes, rolesRes] = await Promise.all([
    supabase.from('users').select('*, role:roles(name,code), branch:branches(name)').order('full_name'),
    supabase.from('branches').select('*').order('name'),
    supabase.from('roles').select('*').order('name'),
  ])

  const users = usersRes.data ?? []
  const branches = branchesRes.data ?? []
  const roles = rolesRes.data ?? []

  const ROLE_COLOUR: Record<string, string> = {
    super_admin:    'bg-red-100 text-red-700',
    transport_mgr:  'bg-purple-100 text-purple-700',
    transport_supv: 'bg-blue-100 text-blue-700',
    branch_mgr:     'bg-teal-100 text-teal-700',
    driver:         'bg-green-100 text-green-700',
    finance:        'bg-amber-100 text-amber-700',
    maintenance:    'bg-gray-100 text-gray-600',
    readonly_mgmt:  'bg-gray-100 text-gray-500',
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin & Settings</h1>
          <p className="page-subtitle">Users, roles, branches, and system configuration</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Users table */}
        <div className="xl:col-span-2 card">
          <div className="card-header">
            <span className="card-title">User Access</span>
            <button className="btn btn-primary btn-sm">+ Invite User</button>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Branch</th><th>Status</th><th>Last Login</th></tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id}>
                    <td className="font-medium">{u.full_name}</td>
                    <td className="text-[12.5px] text-gray-500">{u.email}</td>
                    <td>
                      <span className={`badge ${ROLE_COLOUR[u.role?.code] ?? 'bg-gray-100 text-gray-500'}`}>
                        {u.role?.name ?? '—'}
                      </span>
                    </td>
                    <td className="text-[13px]">{u.branch?.name ?? <span className="text-gray-400">All branches</span>}</td>
                    <td>
                      <span className={`badge ${u.status==='active'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="text-[12px] text-gray-400">{u.last_login_at ? formatDate(u.last_login_at,'dd MMM HH:mm') : 'Never'}</td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-400">No users yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">

          {/* Roles reference */}
          <div className="card">
            <div className="card-header"><span className="card-title">Roles</span></div>
            <div className="card-body space-y-2">
              {roles.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between">
                  <span className={`badge ${ROLE_COLOUR[r.code] ?? 'bg-gray-100 text-gray-500'}`}>{r.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Branches */}
          <div className="card">
            <div className="card-header"><span className="card-title">Branches</span></div>
            <div className="card-body space-y-2">
              {branches.map((b: any) => (
                <div key={b.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-semibold text-[13px]">{b.name}</div>
                    <div className="text-[11.5px] text-gray-400">{b.code} · {b.entity} · {b.city}</div>
                  </div>
                  <span className={`badge ${b.status==='active'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{b.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* System info */}
          <div className="card">
            <div className="card-header"><span className="card-title">System Info</span></div>
            <div className="card-body space-y-3">
              {[
                { label:'Version',        value:'FFC-TMS v1.0.0' },
                { label:'Phase',          value:'Phase 1 — Active' },
                { label:'Database',       value:'Supabase (PostgreSQL 15)' },
                { label:'Auth',           value:'Supabase Auth' },
                { label:'Hosting',        value:'Cloudflare Pages' },
                { label:'PWA',            value:'next-pwa (Enabled)' },
              ].map((s,i) => (
                <div key={i} className="flex justify-between text-[13px] py-1 border-b border-gray-100 last:border-0">
                  <span className="text-gray-500">{s.label}</span>
                  <span className="font-semibold text-gray-800">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
