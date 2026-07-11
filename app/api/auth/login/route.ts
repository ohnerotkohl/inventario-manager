import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";

// Debe coincidir con la sal usada al generar los pin_hash existentes.
const PIN_SALT = "ohne_rotkohl_2024";

function hashPin(pin: string): string {
  return createHash("sha256").update(pin + PIN_SALT).digest("hex");
}

// Comparación en tiempo constante para no filtrar información por el tiempo.
function hashesIguales(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

// Verifica el PIN EN EL SERVIDOR (el hash nunca llega al navegador) y, si es
// correcto, devuelve una sesión autenticada real de Supabase. Con RLS activado,
// esa sesión es lo único que permite leer/escribir la base de datos.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { userId, pin } = (body ?? {}) as { userId?: unknown; pin?: unknown };
  if (typeof userId !== "string" || typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const appEmail = process.env.APP_AUTH_EMAIL;
  const appPassword = process.env.APP_AUTH_PASSWORD;
  if (!url || !serviceKey || !anonKey || !appEmail || !appPassword) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  // 1) Buscar el usuario y verificar el PIN con la service_role key (server-only).
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: usuario, error } = await admin
    .from("usuarios")
    .select("id, nombre, rol, puede_inventario, cajas_permitidas, pin_hash, activo")
    .eq("id", userId)
    .eq("activo", true)
    .maybeSingle();
  if (error || !usuario || typeof usuario.pin_hash !== "string") {
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }
  if (!hashesIguales(hashPin(pin), usuario.pin_hash)) {
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }

  // 2) PIN correcto → iniciar sesión en la cuenta compartida de la app para
  //    obtener una sesión autenticada de Supabase. Cada dispositivo obtiene su
  //    propia sesión (refresh token independiente), así no se pisan entre sí.
  const authClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: signIn, error: signErr } = await authClient.auth.signInWithPassword({
    email: appEmail,
    password: appPassword,
  });
  if (signErr || !signIn.session) {
    return NextResponse.json({ error: "auth_failed" }, { status: 500 });
  }

  return NextResponse.json({
    session: {
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
    },
    user: {
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol,
      puede_inventario: usuario.puede_inventario,
      cajas_permitidas: usuario.cajas_permitidas ?? null,
    },
  });
}
