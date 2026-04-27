import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: user } = await supabase
    .from('users')
    .select('*, role:roles(*), branch:branches(*)')
    .eq('id', session.user.id)
    .single()

  return <AppShell user={user}>{children}</AppShell>
}
