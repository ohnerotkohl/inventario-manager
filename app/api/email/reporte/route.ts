import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  const { mercado, fecha, trabajador, hora, a4, a3, notas, ideas, faltanTarjetas, faltanStickers } = await req.json();

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const fechaFormateada = new Date(fecha + "T12:00:00").toLocaleDateString("es-DE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // Combinar A4 y A3 en una sola tabla por póster
  type PosterData = { a4qty?: number; a4stock?: number; a3qty?: number; a3stock?: number };
  const posterMap: { [name: string]: PosterData } = {};

  for (const item of (a4 as { linea: string; stockRestante: number }[])) {
    const match = item.linea.match(/^(\d+)x (.+)$/);
    if (!match) continue;
    const name = match[2];
    posterMap[name] = posterMap[name] || {};
    posterMap[name].a4qty = parseInt(match[1]);
    posterMap[name].a4stock = item.stockRestante;
  }
  for (const item of (a3 as { linea: string; stockRestante: number }[])) {
    const match = item.linea.match(/^(\d+)x (.+)$/);
    if (!match) continue;
    const name = match[2];
    posterMap[name] = posterMap[name] || {};
    posterMap[name].a3qty = parseInt(match[1]);
    posterMap[name].a3stock = item.stockRestante;
  }

  function stockCell(qty: number | undefined, stock: number | undefined) {
    if (qty === undefined || stock === undefined) return `<td style="padding:8px 10px; border-bottom:1px solid #f0f0f0; color:#ccc; text-align:center;">—</td>`;
    const ok = stock >= 5;
    return `
      <td style="padding:8px 10px; border-bottom:1px solid #f0f0f0; text-align:center;">
        <span style="font-weight:bold; color:#111;">${qty}x</span>
        <br/>
        <span style="font-size:11px; color:${ok ? "#22c55e" : "#ef4444"}; font-weight:bold;">
          ${ok ? `✓ ${stock}` : `⚠ ${stock}`}
        </span>
      </td>
    `;
  }

  const filas = Object.entries(posterMap).map(([nombre, d]) => {
    const alerta = (d.a4stock !== undefined && d.a4stock < 5) || (d.a3stock !== undefined && d.a3stock < 5);
    return `
      <tr style="background:${alerta ? "#fff9f9" : "white"}">
        <td style="padding:8px 12px; border-bottom:1px solid #f0f0f0; font-size:13px; font-weight:${alerta ? "bold" : "normal"}; color:${alerta ? "#111" : "#444"};">
          ${alerta ? `<span style="color:#ef4444; margin-right:4px;">●</span>` : `<span style="color:#22c55e; margin-right:4px;">●</span>`}
          ${nombre}
        </td>
        ${stockCell(d.a4qty, d.a4stock)}
        ${stockCell(d.a3qty, d.a3stock)}
      </tr>
    `;
  }).join("");

  let html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #000; padding: 20px; text-align:center;">
        <img src="https://cdn.shopify.com/s/files/1/0955/8471/5077/files/logo-negro.png?v=1776366342" alt="Ohne Rotkohl" style="height:48px; filter:invert(1);" />
        <p style="margin:8px 0 0; color:#aaa; font-size:14px;">Reporte de impresión</p>
      </div>
      <div style="padding: 20px;">
        <h2 style="color:#111; margin-top:0;">Reporte de impresión — ${mercado}</h2>
        <p style="color:#666; font-size:14px; margin-top:-8px;">${fechaFormateada} · ${trabajador}</p>
        <p style="color:#aaa; font-size:12px; margin-top:4px;">Enviado a las ${hora}</p>

        <table style="width:100%; border-collapse:collapse; margin-top:16px;">
          <thead>
            <tr style="background:#f5f5f5;">
              <th style="padding:8px 12px; text-align:left; font-size:12px; color:#666; font-weight:600; border-bottom:2px solid #e5e5e5;">Póster</th>
              <th style="padding:8px 10px; text-align:center; font-size:12px; color:#b45309; font-weight:600; border-bottom:2px solid #fbbf24; width:90px;">A4</th>
              <th style="padding:8px 10px; text-align:center; font-size:12px; color:#1d4ed8; font-weight:600; border-bottom:2px solid #3b82f6; width:90px;">A3</th>
            </tr>
          </thead>
          <tbody>
            ${filas}
          </tbody>
        </table>
  `;

  const totalImprimir = [...a4, ...a3].filter((i: { stockRestante: number }) => i.stockRestante < 5).length;
  const totalOk = [...a4, ...a3].filter((i: { stockRestante: number }) => i.stockRestante >= 5).length;

  html += `
      <div style="margin-top:24px; background:#f9fafb; border-radius:12px; padding:16px;">
        <table style="width:100%; text-align:center;">
          <tr>
            <td>
              <p style="font-size:28px; font-weight:bold; color:#ef4444; margin:0;">${totalImprimir}</p>
              <p style="color:#666; font-size:12px; margin:4px 0 0;">para imprimir</p>
            </td>
            <td>
              <p style="font-size:28px; font-weight:bold; color:#22c55e; margin:0;">${totalOk}</p>
              <p style="color:#666; font-size:12px; margin:4px 0 0;">stock ok</p>
            </td>
          </tr>
        </table>
      </div>
      ${(faltanTarjetas || faltanStickers) ? `
      <div style="margin-top:24px; background:#fef2f2; border:1px solid #fecaca; border-radius:12px; padding:16px;">
        <p style="font-size:11px; font-weight:bold; text-transform:uppercase; letter-spacing:0.08em; color:#dc2626; margin:0 0 10px;">⚠ Materiales faltantes</p>
        ${faltanTarjetas ? `<p style="font-size:14px; color:#7f1d1d; margin:0 0 4px;">• Faltan tarjetas</p>` : ""}
        ${faltanStickers ? `<p style="font-size:14px; color:#7f1d1d; margin:0 0 4px;">• Faltan stickers</p>` : ""}
      </div>` : ""}

      ${notas ? `
      <div style="margin-top:24px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:16px;">
        <p style="font-size:11px; font-weight:bold; text-transform:uppercase; letter-spacing:0.08em; color:#6b7280; margin:0 0 8px;">Comisiones / encargos</p>
        <p style="font-size:14px; color:#1c1917; margin:0; white-space:pre-wrap;">${notas}</p>
      </div>` : ""}

      ${ideas ? `
      <div style="margin-top:16px; background:#fffbeb; border:1px solid #fde68a; border-radius:12px; padding:16px;">
        <p style="font-size:11px; font-weight:bold; text-transform:uppercase; letter-spacing:0.08em; color:#92400e; margin:0 0 8px;">💡 Ideas del mercado</p>
        <p style="font-size:14px; color:#1c1917; margin:0; white-space:pre-wrap;">${ideas}</p>
      </div>` : ""}

      <p style="margin-top:32px; color:#999; font-size:12px;">
        Generado automáticamente por la app de Ohne Rotkohl
      </p>
    </div>
  </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Ohne Rotkohl App" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      subject: `Reporte de sesión — ${mercado} — ${fechaFormateada}`,
      html,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Email error:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
