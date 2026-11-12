// Localiza la estampilla de Deutsche Post (Internetmarke "1 Stk") dentro del
// PDF que descarga Marcello, para recortarla y ponerla en la etiqueta.
//
// Deutsche Post no la pone siempre en el mismo sitio de la hoja (hay al menos
// dos posiciones), así que no sirve una caja fija. Lo que sí es fijo es el
// dibujo de la estampilla respecto a su código datamatrix (la única imagen):
// logo, fecha, importe y códigos quedan hasta ~99 pt a su derecha y ~57 pt
// por encima. Las internacionales llevan además un texto a la izquierda
// ("PRIORITY P.P."), así que se amplía hacia la izquierda hasta el texto más
// a la izquierda que haya cerca del código.
//
// Recibe el contenido (ya descomprimido) de la página y devuelve la caja en
// puntos PDF, o null si no encuentra el código.

export type Caja = { left: number; bottom: number; right: number; top: number };

type M = [number, number, number, number, number, number];
const mul = (a: M, b: M): M => [
  a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
  a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5],
];
const punto = (m: M, x: number, y: number) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });

export function localizarEstampilla(contenido: string): Caja | null {
  // Quitar textos (...) y <...> para que sus dígitos no se lean como números
  const limpio = contenido
    .replace(/\((?:\\.|[^\\)])*\)/g, " ")
    .replace(/<[0-9A-Fa-f\s]*>/g, " ");
  const tokens = limpio.match(/\/[^\s/[\]()<>]+|[-+]?(?:\d+\.?\d*|\.\d+)|[A-Za-z*'"]+/g) || [];

  let ctm: M = [1, 0, 0, 1, 0, 0];
  const pila: M[] = [];
  let nums: number[] = [];
  let tm: M = [1, 0, 0, 1, 0, 0];
  let lm: M = [1, 0, 0, 1, 0, 0];
  const imagenes: { L: number; B: number; R: number; T: number }[] = [];
  const textos: { x: number; y: number }[] = [];

  for (const tk of tokens) {
    if (/^[-+]?(?:\d|\.\d)/.test(tk)) { nums.push(parseFloat(tk)); continue; }
    if (tk.startsWith("/")) { nums = []; continue; }
    switch (tk) {
      case "q": pila.push(ctm); break;
      case "Q": ctm = pila.pop() || ctm; break;
      case "cm": if (nums.length >= 6) ctm = mul(nums.slice(-6) as M, ctm); break;
      case "BT": tm = [1, 0, 0, 1, 0, 0]; lm = tm; break;
      case "Tm": if (nums.length >= 6) { tm = nums.slice(-6) as M; lm = tm; } break;
      case "Td": case "TD": if (nums.length >= 2) { lm = mul([1, 0, 0, 1, nums[nums.length - 2], nums[nums.length - 1]], lm); tm = lm; } break;
      case "Tj": case "TJ": case "'": case '"': {
        const p = punto(mul(tm, ctm), 0, 0);
        textos.push(p);
        break;
      }
      case "Do": {
        const ps = [punto(ctm, 0, 0), punto(ctm, 1, 0), punto(ctm, 0, 1), punto(ctm, 1, 1)];
        const xs = ps.map((p) => p.x), ys = ps.map((p) => p.y);
        imagenes.push({ L: Math.min(...xs), R: Math.max(...xs), B: Math.min(...ys), T: Math.max(...ys) });
        break;
      }
    }
    nums = [];
  }

  // El datamatrix: imagen casi cuadrada de unos 31 pt
  const dm = imagenes.find((i) => {
    const w = i.R - i.L, h = i.T - i.B;
    return w > 20 && w < 45 && Math.abs(w - h) < 3;
  });
  if (!dm) return null;

  // Textos de la propia estampilla (cerca del código, no los de otras partes de la hoja)
  const cerca = textos.filter((p) => p.x > dm.L - 80 && p.x < dm.L + 110 && p.y > dm.B - 10 && p.y < dm.B + 70);
  const izqTexto = cerca.length ? Math.min(...cerca.map((p) => p.x)) : dm.L;

  return {
    left: Math.min(dm.L - 7, izqTexto - 3),
    bottom: dm.B - 6,
    right: dm.L + 105,
    top: dm.B + 63,
  };
}

// Las cruces de corte que Deutsche Post dibuja alrededor del sello son las
// únicas líneas punteadas del PDF ("[...] fase d" ... "S"). Se cambian por "n"
// (terminar el trazo sin pintarlo) para que no salgan en la etiqueta. Solo se
// aplica a la copia que se usa para la etiqueta; el PDF original no se toca.
export function quitarMarcasDeCorte(contenido: string): string {
  return contenido.replace(
    /(\[[\d.\s]+\]\s*[\d.]+\s+d\b(?:(?!\bBT\b)[\s\S])*?)(\s)S(?=\s)/g,
    "$1$2n",
  );
}
