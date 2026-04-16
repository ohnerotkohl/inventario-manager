import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  const { materialesRestock, insumosCompra, cajas } = await req.json();

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const fecha = new Date().toLocaleDateString("es-DE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  let html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="background: #000; color: #fff; padding: 20px; margin: 0;">
        OHNE <span style="color: #ef4444;">ROTKOHL</span>
      </h1>
      <div style="padding: 20px;">
        <h2 style="color: #111;">📋 Lista de compras — ${fecha}</h2>
  `;

  if (materialesRestock.length > 0) {
    const porCaja: { [cajaId: string]: typeof materialesRestock } = {};
    for (const m of materialesRestock) {
      if (!porCaja[m.caja_id]) porCaja[m.caja_id] = [];
      porCaja[m.caja_id].push(m);
    }

    html += `<h3 style="color: #333; border-bottom: 2px solid #f59e0b; padding-bottom: 8px;">📦 Materiales de cajas</h3>`;
    for (const [cajaId, mats] of Object.entries(porCaja)) {
      const caja = cajas.find((c: { id: string; nombre: string }) => c.id === cajaId);
      html += `<p style="font-weight: bold; color: #555;">${caja?.nombre || cajaId}</p><ul>`;
      for (const m of mats) {
        html += `<li style="color: #ef4444; font-weight: bold;">${m.nombre}</li>`;
      }
      html += `</ul>`;
    }
  }

  if (insumosCompra.length > 0) {
    html += `
      <h3 style="color: #333; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; margin-top: 24px;">🔬 Insumos del estudio — Comprar/Producir</h3>
      <ul>
    `;
    for (const ins of insumosCompra) {
      html += `<li style="color: #ef4444; font-weight: bold;">${ins.nombre} <span style="color: #999; font-weight: normal;">(stock actual: ${ins.cantidad} ${ins.unidad})</span></li>`;
    }
    html += `</ul>`;
  }

  html += `
      <p style="margin-top: 32px; color: #999; font-size: 12px;">
        Generado automáticamente por la app de Ohne Rotkohl
      </p>
    </div>
  </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Ohne Rotkohl App" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      subject: `Lista de compras — ${fecha}`,
      html,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Email error:", error);
    return NextResponse.json({ ok: false, error: "Error enviando email" }, { status: 500 });
  }
}
