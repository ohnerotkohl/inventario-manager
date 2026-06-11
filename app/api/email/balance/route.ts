import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

type Gasto = { nombre: string; monto: number; efectivo: boolean };

export async function POST(req: NextRequest) {
  const b = await req.json();

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const fechaFormateada = new Date(b.fecha + "T12:00:00").toLocaleDateString("es-DE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const eur = (n: number) => (Number(n) || 0).toFixed(2) + " €";

  const filaVenta = (label: string, monto: number) =>
    Number(monto) > 0
      ? `<tr><td style="padding:6px 12px; color:#666; font-size:13px;">${label}</td><td style="padding:6px 12px; text-align:right; font-size:13px; color:#111;">${eur(monto)}</td></tr>`
      : "";

  const gastos: Gasto[] = b.gastos || [];
  const filasGastos = gastos
    .map((g) => `<tr><td style="padding:6px 12px; color:#666; font-size:13px;">${g.nombre || "—"}${g.efectivo ? " <span style='color:#b45309; font-size:11px;'>(efectivo)</span>" : ""}</td><td style="padding:6px 12px; text-align:right; font-size:13px; color:#111;">${eur(g.monto)}</td></tr>`)
    .join("");

  const filaTurno = Number(b.turno_costo) > 0
    ? `<tr><td style="padding:6px 12px; color:#b45309; font-size:13px;">Costo turno (${b.turno_horas}h × ${b.turno_tarifa}€)</td><td style="padding:6px 12px; text-align:right; font-size:13px; color:#b45309;">${eur(b.turno_costo)}</td></tr>`
    : "";

  const filaIva = b.iva_aplicado
    ? `<tr><td style="padding:6px 12px; color:#dc2626; font-size:13px;">IVA 19% (ventas con tarjeta)</td><td style="padding:6px 12px; text-align:right; font-size:13px; color:#dc2626;">${eur(b.iva_monto)}</td></tr>`
    : "";

  const netoPos = Number(b.neto) >= 0;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #000; padding: 20px; text-align:center;">
        <img src="https://cdn.shopify.com/s/files/1/0955/8471/5077/files/logo-negro.png?v=1776366342" alt="Ohne Rotkohl" style="height:48px; filter:invert(1);" />
        <p style="margin:8px 0 0; color:#aaa; font-size:14px;">Balance de mercado</p>
      </div>
      <div style="padding: 20px;">
        <h2 style="color:#111; margin-top:0;">Balance — ${b.mercado_nombre}</h2>
        <p style="color:#666; font-size:14px; margin-top:-8px;">${fechaFormateada} · ${b.trabajador}</p>
        ${Number(b.float_inicial) > 0 ? `<p style="color:#aaa; font-size:12px;">Float (fondo de cambio): ${eur(b.float_inicial)}</p>` : ""}

        <p style="font-size:11px; font-weight:bold; text-transform:uppercase; letter-spacing:0.08em; color:#16a34a; margin:20px 0 6px;">Ventas</p>
        <table style="width:100%; border-collapse:collapse; background:#f9fafb; border-radius:8px;">
          ${filaVenta("SumUp (tarjeta)", b.venta_sumup)}
          ${filaVenta("Efectivo", b.venta_efectivo)}
          ${filaVenta("PayPal", b.venta_paypal)}
          <tr><td style="padding:8px 12px; font-weight:bold; font-size:13px; border-top:1px solid #e5e7eb;">TOTAL VENTAS</td><td style="padding:8px 12px; text-align:right; font-weight:bold; font-size:13px; color:#16a34a; border-top:1px solid #e5e7eb;">${eur(b.total_ventas)}</td></tr>
        </table>

        <p style="font-size:11px; font-weight:bold; text-transform:uppercase; letter-spacing:0.08em; color:#dc2626; margin:20px 0 6px;">Gastos</p>
        <table style="width:100%; border-collapse:collapse; background:#f9fafb; border-radius:8px;">
          ${filasGastos}
          ${filaTurno}
          ${filaIva}
          <tr><td style="padding:8px 12px; font-weight:bold; font-size:13px; border-top:1px solid #e5e7eb;">TOTAL GASTOS</td><td style="padding:8px 12px; text-align:right; font-weight:bold; font-size:13px; color:#dc2626; border-top:1px solid #e5e7eb;">${eur(b.total_gastos)}</td></tr>
        </table>

        <div style="margin-top:24px; background:${netoPos ? "#f0fdf4" : "#fef2f2"}; border:1px solid ${netoPos ? "#bbf7d0" : "#fecaca"}; border-radius:12px; padding:16px; text-align:center;">
          <p style="font-size:12px; color:#666; margin:0;">BALANCE FINAL</p>
          <p style="font-size:32px; font-weight:bold; color:${netoPos ? "#16a34a" : "#dc2626"}; margin:4px 0 0;">${netoPos ? "+" : ""}${eur(b.neto)}</p>
          <p style="font-size:11px; color:#999; margin:6px 0 0;">${eur(b.total_ventas)} ventas − ${eur(b.total_gastos)} gastos</p>
        </div>

        <p style="margin-top:32px; color:#999; font-size:12px;">
          Generado automáticamente por la app de Ohne Rotkohl
        </p>
      </div>
    </div>
  `;

  // Mauerpark (Marcello) y RAW (Nuria) son contabilidad personal — no van al correo del negocio
  const destinatario =
    b.mercado_nombre === "Mauerpark" ? "marcello.castellani@gmail.com"
    : b.mercado_nombre === "RAW" ? "nuriajuncamarti@gmail.com"
    : process.env.EMAIL_TO;

  try {
    await transporter.sendMail({
      from: `"Ohne Rotkohl App" <${process.env.EMAIL_USER}>`,
      to: destinatario,
      subject: `Balance — ${b.mercado_nombre} — ${fechaFormateada}`,
      html,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Email error:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
