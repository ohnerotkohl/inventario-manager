import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Lista de usuarios activos para la pantalla de login: SOLO id y nombre.
// El PIN cifrado (pin_hash) NUNCA se envía al navegador (antes el login hacía
// select("*") y exponía los hashes a cualquier visitante anónimo).
// Usa la service_role key (solo servidor) para leer aunque la tabla tenga RLS.
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await admin
    .from("usuarios")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre");
  if (error) {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  return NextResponse.json({ users: data ?? [] });
}
