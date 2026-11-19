import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  console.warn('[supabase] .env faylında VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY yoxdur')
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  // PKCE — HashRouter ilə stabil: `?code=` query-də qalır, hash (`#/reset-password`) silinmir
  auth: { flowType: 'pkce' },
  realtime: { params: { eventsPerSecond: 10 } },
})
