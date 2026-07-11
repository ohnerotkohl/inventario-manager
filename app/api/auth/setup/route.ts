import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

const PIN_SALT = "ohne_rotkohl_2024";

function hashPin(pin: string): string {
  return createHash("sha256").update(pin + PIN_SALT).digest("hex");
}

// Crea el PRIMER admin. Solo funciona si aún no existe ningún usuario: antes
// /setup era una página pública que dejaba a cualquiera crear un admin.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { nombre, pin } = (body ?? {}) as { nombre?: unknown; pin?: unknown };
  if (typeof nombre !== "string" || !nombre.trim() || typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { count, error: countErr } = await admin
    .from("usuarios")
    .select("*", { count: "exact", head: true });
  if (countErr) {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: "already_setup" }, { status: 403 });
  }

  const { error: insertErr } = await admin.from("usuarios").insert({
    nombre: nombre.trim(),
    pin_hash: hashPin(pin),
    rol: "admin",
    puede_inventario: true,
    activo: true,
  });
  if (insertErr) {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
