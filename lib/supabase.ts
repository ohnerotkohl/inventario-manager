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

// Trae TODAS las filas de una consulta paginando de 1000 en 1000.
// PostgREST (Supabase) devuelve como máximo 1000 filas por defecto: sin paginar,
// cualquier agregación (estadísticas, finanzas, bestsellers) se trunca en
// silencio en cuanto la tabla supera esas 1000 filas, mostrando cifras erróneas
// sin ningún aviso. `buildQuery` debe devolver una consulta NUEVA en cada llamada
// (p.ej. () => supabase.from("ventas").select(...)); el helper le aplica .range().
export async function fetchAllRows<T = Record<string, unknown>>(
  buildQuery: () => { range: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }> }
): Promise<T[]> {
  const PAGE = 1000
  const all: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await buildQuery().range(from, from + PAGE - 1)
    const rows = (data as T[] | null) ?? []
    if (error || rows.length === 0) break
    all.push(...rows)
    if (rows.length < PAGE) break
  }
  return all
}
