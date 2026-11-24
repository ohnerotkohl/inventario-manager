// Miniaturas de los pósters (unos 240 px de ancho, ~20 KB) para mostrarlos en
// listas sin descargar las imágenes de imprimir, que pesan entre 5 y 17 MB.
//
// Viven en el mismo bucket "Posters", dentro de la carpeta "miniaturas/", con
// el mismo nombre de archivo que la imagen grande. Supabase no las genera solo
// (la transformación de imágenes no está en el plan), así que las crea el
// navegador la primera vez que hacen falta: baja la grande, la achica y la sube.
// Para poder subirlas hace falta la política de supabase-migrations/miniaturas-posters.sql.

import { supabase } from "@/lib/supabase";

const BUCKET = "Posters";
const CARPETA = "miniaturas/";
const ANCHO = 240;

// Mismo nombre de archivo que usa /imprimir (app/imprimir/page.tsx)
export function archivoPoster(nombre: string): string {
  return nombre
    .replace(/ö/g, "o").replace(/Ö/g, "O")
    .replace(/ü/g, "u").replace(/Ü/g, "U")
    .replace(/ä/g, "a").replace(/Ä/g, "A")
    .replace(/ñ/g, "n").replace(/Ñ/g, "N")
    + ".jpg";
}

// Supabase devuelve la URL firmada con el path sin codificar; un '?' en el
// nombre ("Wie Geht's? - Mauerpark.jpg") la corta. Igual que en /imprimir.
function arreglarUrl(u: string): string {
  const i = u.lastIndexOf("?token=");
  if (i === -1) return u;
  const marca = "/object/sign/";
  const prefijo = u.slice(0, i);
  const m = prefijo.indexOf(marca);
  if (m === -1) return u;
  const ruta = prefijo.slice(m + marca.length).split("/").map((seg) => {
    let raw = seg;
    try { raw = decodeURIComponent(seg); } catch { /* % literal */ }
    return encodeURIComponent(raw);
  }).join("/");
  return prefijo.slice(0, m + marca.length) + ruta + u.slice(i);
}

// Ruta de la miniatura. Sin '?' ni '#': la librería de Supabase no los codifica
// al subir y cortan la dirección ("Wie Geht's? - Mauerpark").
function rutaMiniatura(nombre: string): string {
  return CARPETA + archivoPoster(nombre).replace(/[?#]/g, "");
}

/** URLs de las miniaturas que ya existen, por nombre de póster. Las que faltan no vienen. */
export async function cargarMiniaturas(nombres: string[]): Promise<Record<string, string>> {
  if (nombres.length === 0) return {};
  const porRuta: Record<string, string> = {};
  for (const n of nombres) porRuta[rutaMiniatura(n)] = n;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(Object.keys(porRuta), 3600);
  const out: Record<string, string> = {};
  for (const e of data || []) {
    if (e.error || !e.signedUrl || !e.path) continue;
    const n = porRuta[e.path];
    if (n) out[n] = arreglarUrl(e.signedUrl);
  }
  return out;
}

/** Crea la miniatura de un póster a partir de su imagen grande. Devuelve su URL, o null si no se pudo. */
export async function crearMiniatura(nombre: string): Promise<string | null> {
  try {
    const archivo = archivoPoster(nombre);
    const { data: firmada } = await supabase.storage.from(BUCKET).createSignedUrl(archivo, 600);
    if (!firmada?.signedUrl) return null;
    const res = await fetch(arreglarUrl(firmada.signedUrl));
    if (!res.ok) return null;
    const bmp = await createImageBitmap(await res.blob());
    const alto = Math.round((bmp.height / bmp.width) * ANCHO);
    const lienzo = document.createElement("canvas");
    lienzo.width = ANCHO;
    lienzo.height = alto;
    lienzo.getContext("2d")!.drawImage(bmp, 0, 0, ANCHO, alto);
    bmp.close();
    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", 0.8));
    if (!blob) return null;
    const { error } = await supabase.storage.from(BUCKET).upload(rutaMiniatura(nombre), blob, { contentType: "image/jpeg", upsert: false });
    if (error) return null;
    const m = await cargarMiniaturas([nombre]);
    return m[nombre] || null;
  } catch {
    return null;
  }
}
