import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || 'https://kzzqrormwligrdbrxsrw.supabase.co'
const key = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_isMS7d3wwjP2NRJzlRR4lA_TVrMTmS1'

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})
