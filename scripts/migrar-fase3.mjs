// Migración Fase 3: copia los datos de "compras y tareas OR" (Supabase viejo)
// a la base unificada del Inventario Manager. NO borra nada del origen.
// Requiere haber ejecutado antes supabase-migrations/fase3-tareas-y-finanzas.sql
// Uso: node scripts/migrar-fase3.mjs

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function leerEnv(ruta) {
  const env = {};
  for (const linea of readFileSync(ruta, "utf8").split("\n")) {
    const m = linea.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const nuevo = leerEnv(resolve(root, ".env.local"));
const viejo = leerEnv(resolve(root, "../compras y tareas OR/.env.local"));

async function api(base, key, path, opts = {}) {
  const res = await fetch(`${base}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: opts.method === "POST" ? "return=minimal" : "count=exact",
      ...opts.headers,
    },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.status === 201 ? null : res.json();
}

const leerViejo = (path) => api(viejo.NEXT_PUBLIC_SUPABASE_URL, viejo.NEXT_PUBLIC_SUPABASE_ANON_KEY, path);
const leerNuevo = (path) => api(nuevo.NEXT_PUBLIC_SUPABASE_URL, nuevo.NEXT_PUBLIC_SUPABASE_ANON_KEY, path);
const insertar = (tabla, filas) =>
  filas.length === 0
    ? Promise.resolve()
    : api(nuevo.NEXT_PUBLIC_SUPABASE_URL, nuevo.NEXT_PUBLIC_SUPABASE_ANON_KEY, tabla, {
        method: "POST",
        body: JSON.stringify(filas),
      });

// ── Mapeo de personas: perfiles/empleados (viejo) → usuarios (nuevo) por nombre
const usuarios = await leerNuevo("usuarios?select=id,nombre");
const perfiles = await leerViejo("perfiles?select=id,nombre");
const empleados = await leerViejo("empleados?select=id,nombre");

const porNombre = new Map(usuarios.map((u) => [u.nombre.toLowerCase(), u.id]));
const idViejoANombre = new Map([
  ...perfiles.map((p) => [p.id, p.nombre]),
  ...empleados.map((e) => [e.id, e.nombre]),
]);

function usuarioNuevo(idViejo) {
  if (!idViejo) return { id: null, nombre: null };
  const nombre = idViejoANombre.get(idViejo) || null;
  return { id: nombre ? porNombre.get(nombre.toLowerCase()) || null : null, nombre };
}

function dificultadDe(coles) {
  if (coles <= 1) return "simple";
  if (coles === 2) return "media";
  return "compleja";
}

// ── TAREAS (conservamos los UUID originales para no romper referencias)
const tareas = await leerViejo("tareas?select=*");
await insertar(
  "tareas",
  tareas.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    descripcion: t.descripcion,
    categoria: t.categoria,
    asignada_a: usuarioNuevo(t.asignada_a).id,
    frecuencia: t.frecuencia,
    proxima_fecha: t.proxima_fecha,
    dificultad: dificultadDe(t.puntos_coles),
    puntos_coles: t.puntos_coles,
    estado: t.estado,
    rotacion: t.rotacion ?? false,
    orden_rotacion: t.orden_rotacion ?? [],
    rotacion_idx: t.rotacion_idx ?? 0,
    creada_por: usuarioNuevo(t.creada_por).id,
    created_at: t.created_at,
    updated_at: t.updated_at,
  }))
);
console.log(`tareas: ${tareas.length} migradas`);

// ── COLES (puntos_log → coles_log)
const puntos = await leerViejo("puntos_log?select=*");
await insertar(
  "coles_log",
  puntos.map((p) => {
    const u = usuarioNuevo(p.usuario_id);
    return {
      id: p.id,
      usuario_id: u.id,
      usuario_nombre: u.nombre || "—",
      coles_delta: p.coles_delta,
      motivo: p.motivo,
      tarea_id: p.tarea_id,
      created_at: p.created_at,
    };
  })
);
console.log(`coles_log: ${puntos.length} migrados`);

// ── TURNOS
const turnos = await leerViejo("turnos?select=*");
await insertar(
  "turnos",
  turnos.map((t) => {
    const u = usuarioNuevo(t.empleado_id || t.empleado_ext_id);
    return {
      id: t.id,
      usuario_id: u.id,
      empleado_nombre: t.empleado_nombre || u.nombre || "—",
      fecha_inicio: t.fecha_inicio,
      fecha_fin: t.fecha_fin,
      descripcion: t.descripcion,
      estado: t.estado,
      created_at: t.created_at,
    };
  })
);
console.log(`turnos: ${turnos.length} migrados`);

// ── CHAT (canales + mensajes)
const canales = await leerViejo("canales?select=*");
await insertar(
  "canales",
  canales.map((c) => ({ id: c.id, nombre: c.nombre, descripcion: c.descripcion, created_at: c.created_at }))
);
console.log(`canales: ${canales.length} migrados`);

const mensajes = await leerViejo("mensajes?select=*");
await insertar(
  "mensajes",
  mensajes.map((m) => {
    const u = usuarioNuevo(m.autor_id);
    return {
      id: m.id,
      canal_id: m.canal_id,
      autor_id: u.id,
      autor_nombre: u.nombre || "—",
      contenido: m.contenido,
      tarea_id: m.tarea_id,
      created_at: m.created_at,
    };
  })
);
console.log(`mensajes: ${mensajes.length} migrados`);

// ── GASTOS
const gastos = await leerViejo("gastos?select=*");
await insertar(
  "gastos",
  gastos.map((g) => ({
    id: g.id,
    fecha: g.fecha,
    importe: g.importe,
    descripcion: g.descripcion,
    categoria: g.categoria,
    registrado_por: usuarioNuevo(g.registrado_por).nombre,
    created_at: g.created_at,
  }))
);
console.log(`gastos: ${gastos.length} migrados`);

// ── LISTA DE COMPRAS
const compras = await leerViejo("compras?select=*");
await insertar(
  "lista_compras",
  compras.map((c) => ({
    id: c.id,
    producto: c.producto,
    cantidad: c.cantidad,
    unidad: c.unidad,
    precio: c.precio,
    categoria: c.categoria,
    quien_compra: usuarioNuevo(c.quien_compra).nombre,
    urgente: c.urgente,
    estado: c.estado,
    fecha_compra: c.fecha_compra,
    created_at: c.created_at,
  }))
);
console.log(`lista_compras: ${compras.length} migradas`);

// ── INGRESOS HISTÓRICOS
const ingresos = await leerViejo("ingresos?select=*");
await insertar(
  "ingresos_historicos",
  ingresos.map((i) => ({
    id: i.id,
    fecha: i.fecha,
    evento: i.evento.trim(),
    total: i.total,
    notas: i.notas,
    registrado_por: usuarioNuevo(i.registrado_por).nombre,
    created_at: i.created_at,
  }))
);
console.log(`ingresos_historicos: ${ingresos.length} migrados`);

console.log("\n✅ Migración completada. Los datos del origen quedan intactos.");
