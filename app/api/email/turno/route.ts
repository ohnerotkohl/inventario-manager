import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

function fechaIcs(iso: string): string {
  // 2026-06-14T07:00:00.000Z → 20260614T070000Z (UTC, válido en cualquier zona)
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export async function POST(req: NextRequest) {
  const { id, nombre, email, fecha_inicio, fecha_fin, descripcion } = await req.json();

  if (!email || !fecha_inicio || !fecha_fin) {
    return NextResponse.json({ ok: false, error: "Faltan campos" }, { status: 400 });
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const opciones = { timeZone: "Europe/Berlin" } as const;
  const inicio = new Date(fecha_inicio);
  const fin = new Date(fecha_fin);
  const fechaBonita = inicio.toLocaleDateString("es-DE", {
    ...opciones, weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const horaInicio = inicio.toLocaleTimeString("es-DE", { ...opciones, hour: "2-digit", minute: "2-digit" });
  const horaFin = fin.toLocaleTimeString("es-DE", { ...opciones, hour: "2-digit", minute: "2-digit" });

  const resumen = `Turno Ohne Rotkohl${descripcion ? ` — ${descripcion}` : ""}`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ohne Rotkohl//Turnos//ES",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:turno-${id}@ohnerotkohl.com`,
    `DTSTAMP:${fechaIcs(new Date().toISOString())}`,
    `DTSTART:${fechaIcs(fecha_inicio)}`,
    `DTEND:${fechaIcs(fecha_fin)}`,
    `SUMMARY:${resumen}`,
    `DESCRIPTION:Turno de trabajo con Ohne Rotkohl.${descripcion ? ` ${descripcion}.` : ""} Work shift with Ohne Rotkohl.`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #000; padding: 20px; text-align:center;">
        <img src="https://cdn.shopify.com/s/files/1/0955/8471/5077/files/logo-negro.png?v=1776366342" alt="Ohne Rotkohl" style="height:48px; filter:invert(1);" />
        <p style="margin:8px 0 0; color:#aaa; font-size:14px;">Turno asignado · Shift assigned</p>
      </div>
      <div style="padding: 24px;">
        <h2 style="color:#111; margin-top:0;">¡Hola${nombre ? ` ${nombre}` : ""}! 👋</h2>
        <p style="color:#444; font-size:15px; line-height:1.6;">
          Tienes un turno de trabajo con <strong>Ohne Rotkohl</strong>:<br/>
          <span style="color:#888; font-size:13px;">You have a work shift with Ohne Rotkohl:</span>
        </p>
        <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:20px; margin:16px 0;">
          <p style="font-size:18px; font-weight:bold; color:#111; margin:0; text-transform:capitalize;">${fechaBonita}</p>
          <p style="font-size:15px; color:#444; margin:8px 0 0;">⏰ ${horaInicio} – ${horaFin}</p>
          ${descripcion ? `<p style="font-size:14px; color:#666; margin:8px 0 0;">📍 ${descripcion}</p>` : ""}
        </div>
        <p style="color:#444; font-size:14px; line-height:1.6;">
          📅 Adjuntamos una invitación de calendario: ábrela para guardar el turno en el calendario de tu teléfono.<br/>
          <span style="color:#888; font-size:12px;">We attached a calendar invite — open it to save the shift to your phone's calendar.</span>
        </p>
        <p style="margin-top:28px; color:#999; font-size:12px;">
          Ohne Rotkohl · Berlin · ohnerotkohl.com
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Ohne Rotkohl" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Turno Ohne Rotkohl — ${fechaBonita} (${horaInicio}–${horaFin})`,
      html,
      icalEvent: {
        filename: "turno-ohne-rotkohl.ics",
        method: "publish",
        content: ics,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Email turno error:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
