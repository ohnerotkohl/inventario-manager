import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key || url === 'your_supabase_url_here') return null
  if (!_client) _client = createClient(url, key)
  return _client
}

// Proxy que lanza error descriptivo si no está configurado
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getSupabase()
    if (!client) throw new Error('Supabase not configured')
    return (client as unknown as Record<string | symbol, unknown>)[prop]
  },
})
