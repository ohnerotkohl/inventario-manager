import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  const { mercado, fecha, trabajador, hora, a4, a3 } = await req.json();

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

  function renderItems(items: { linea: string; stockRestante: number }[]) {
    return items.map((item) => {
      const necesita = item.stockRestante < 5;
      return `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0;">
            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${necesita ? "#ef4444" : "#22c55e"}; margin-right:8px; vertical-align:middle;"></span>
            ${item.linea}
          </td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0; text-align:right; font-weight:bold; color:${necesita ? "#ef4444" : "#22c55e"};">
            ${necesita ? `Imprimir (quedan ${item.stockRestante})` : `Stock ok (${item.stockRestante})`}
          </td>
        </tr>
      `;
    }).join("");
  }

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
  `;

  if (a4.length > 0) {
    html += `
      <h3 style="color:#b45309; border-bottom: 2px solid #fbbf24; padding-bottom:8px;">Tamaño A4</h3>
      <table style="width:100%; border-collapse:collapse;">
        ${renderItems(a4)}
      </table>
    `;
  }

  if (a3.length > 0) {
    html += `
      <h3 style="color:#1d4ed8; border-bottom: 2px solid #3b82f6; padding-bottom:8px; margin-top:24px;">Tamaño A3</h3>
      <table style="width:100%; border-collapse:collapse;">
        ${renderItems(a3)}
      </table>
    `;
  }

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
      subject: `Reporte de impresión — ${mercado} — ${fechaFormateada}`,
      html,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Email error:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
