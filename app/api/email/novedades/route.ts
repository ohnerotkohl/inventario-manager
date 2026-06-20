import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

type Novedad = { titulo: string; descripcion?: string | null; pedido_por?: string | null };

// Admins que reciben el aviso de novedades (correos personales)
const ADMINS = ["marcello.castellani@gmail.com", "nuriajuncamarti@gmail.com"];

export async function POST(req: NextRequest) {
  const { novedades } = await req.json();
  const lista: Novedad[] = novedades || [];
  if (lista.length === 0) {
    return NextResponse.json({ ok: false, error: "Sin novedades" }, { status: 400 });
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

  const filas = lista.map((n) => `
    <div style="border-left:3px solid #8b5cf6; padding:8px 14px; margin-bottom:14px;">
      <p style="font-size:15px; font-weight:bold; color:#111; margin:0;">${n.titulo}</p>
      ${n.descripcion ? `<p style="font-size:14px; color:#555; margin:4px 0 0; line-height:1.5;">${n.descripcion}</p>` : ""}
      ${n.pedido_por ? `<p style="font-size:12px; color:#999; margin:4px 0 0;">Pedido por ${n.pedido_por}</p>` : ""}
    </div>
  `).join("");

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #000; padding: 20px; text-align:center;">
        <img src="https://cdn.shopify.com/s/files/1/0955/8471/5077/files/logo-negro.png?v=1776366342" alt="Ohne Rotkohl" style="height:48px; filter:invert(1);" />
        <p style="margin:8px 0 0; color:#aaa; font-size:14px;">Novedades de la app</p>
      </div>
      <div style="padding: 24px;">
        <h2 style="color:#111; margin-top:0;">Hay novedades en la app 🎉</h2>
        <p style="color:#444; font-size:15px; line-height:1.6;">
          Esto es lo que se ha mejorado y actualizado:
        </p>
        <div style="margin:20px 0;">
          ${filas}
        </div>
        <a href="https://inventario-manager.vercel.app" style="display:inline-block; background:#000; color:#fff; text-decoration:none; font-weight:bold; font-size:15px; padding:12px 24px; border-radius:10px;">
          Entrar a verlo →
        </a>
        <p style="margin-top:28px; color:#999; font-size:12px;">
          Ohne Rotkohl · ohnerotkohl.com
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Ohne Rotkohl" <${process.env.EMAIL_USER}>`,
      to: ADMINS,
      subject: `Novedades de la app — ${lista.length} ${lista.length === 1 ? "actualización" : "actualizaciones"}`,
      html,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Email novedades error:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
