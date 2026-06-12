"use client";
export const dynamic = "force-dynamic";
import { useAuth } from "@/app/components/AuthProvider";
import { useLang } from "@/app/components/LangProvider";

const ic = {
  width: 18, height: 18, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.75,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
};

const LlaveIcon = () => (
  <svg {...ic}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
);
const CierreIcon = () => (
  <svg {...ic}><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
);
const BalanceIcon = () => (
  <svg {...ic}><circle cx="12" cy="12" r="10"/><path d="M15 9.5c-.6-1-1.7-1.5-3-1.5-1.8 0-3 1-3 2s.8 1.7 3 2c2.2.3 3 1 3 2s-1.2 2-3 2c-1.3 0-2.4-.5-3-1.5"/><line x1="12" y1="6" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="18"/></svg>
);
const StockIcon = () => (
  <svg {...ic}><rect x="2" y="7" width="20" height="14" rx="1"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>
);
const FeedbackIcon = () => (
  <svg {...ic}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
);
const HomeIcon = () => (
  <svg {...ic}><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>
);
const FinanzasIcon = () => (
  <svg {...ic}><path d="M21 12V7H5a2 2 0 010-4h14v4"/><path d="M3 5v14a2 2 0 002 2h16v-5"/><path d="M18 12a2 2 0 000 4h4v-4z"/></svg>
);
const TareasIcon = () => (
  <svg {...ic}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
);
const TurnosIcon = () => (
  <svg {...ic}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
);
const DespensaIcon = () => (
  <svg {...ic}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 001.95-1.57L23 6H6"/></svg>
);
const StatsIcon = () => (
  <svg {...ic}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
);
const EquipoIcon = () => (
  <svg {...ic}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
);

interface Seccion {
  Icono: () => React.ReactElement;
  titulo: string;
  intro?: string;
  pasos: string[];
  nota?: string;
  soloAdmin?: boolean;
  destacada?: boolean;
}

function secciones(lang: "es" | "en"): Seccion[] {
  if (lang === "en") {
    return [
      {
        Icono: LlaveIcon, titulo: "Logging in",
        pasos: [
          "Open the app and tap your name.",
          "Enter your 4-digit PIN.",
          "Use the EN/ES button at the top to switch language anytime.",
        ],
      },
      {
        Icono: CierreIcon, titulo: "Closing: end of the market day",
        intro: "When your shift ends, close the market: record what sold using your stand's inventory sheet.",
        pasos: [
          "Go to Closing, then New closing.",
          "Pick the market you're closing, check the date and your name.",
          "Tap 'Record sales' and enter how many of each poster you sold (A4 / A3), as written on your paper inventory sheet.",
          "Review the summary and confirm: the stock updates automatically and a report is emailed to the studio.",
          "If you sold a commission or someone suggested an idea, write it in the notes before confirming.",
        ],
        nota: "If you make a mistake, an admin can edit or delete the closing later. Don't panic.",
      },
      {
        Icono: BalanceIcon, titulo: "Balance: the money of the day",
        intro: "Right after closing, record the money so the studio's finances stay accurate.",
        pasos: [
          "Go to Balance and fill in the market, date and your name.",
          "If you worked by hours, choose 'By hours worked' and enter your hours and rate.",
          "Float is the change fund you started with. It is NOT a sale.",
          "Expenses: the stand fee appears automatically; add anything else (transport, etc.). Tick 'cash' if you paid it with cash from the pocket.",
          "Sales: SumUp (card), cash in pocket (count it WITHOUT the float) and PayPal.",
          "Check the final balance and tap 'Save balance': the report is emailed automatically.",
        ],
      },
      {
        Icono: StockIcon, titulo: "Stock: counting inventory",
        pasos: [
          "You can always LOOK at the stock of any market.",
          "To EDIT a count you need permission: an admin enables your access for a specific market, usually when they ask you to count it.",
          "Pick the market, update the quantities, and they save automatically.",
        ],
        nota: "Admins also find Restock here (adding newly printed posters to stock).",
      },
      {
        Icono: FeedbackIcon, titulo: "BETA Feedback: your opinion makes this app better",
        intro: "This app is in beta. If something breaks, confuses you or could be better, tell us. We read everything.",
        pasos: [
          "Tap the BETA button at the top of any screen (the one with shifting colors).",
          "Write what happened, or tap the microphone and SPEAK it.",
          "Next to the mic, pick the language you'll speak in (EN, HI, ES, DE, IT, CA): use your native language, whatever feels natural. We translate it.",
          "Tap 'Send feedback'. Done: it goes straight to Marcello and Nuria.",
        ],
        nota: "Your feedback records the section of the app you were in when you sent it. Send it from the screen where you saw the problem: that way we know exactly what part you mean.",
        destacada: true,
      },
      {
        Icono: HomeIcon, titulo: "Home: the dashboard", soloAdmin: true,
        pasos: [
          "Active alerts: sold-out posters, low stock, missing samples and studio supplies running out.",
          "Pending purchases and the latest market closings, at a glance.",
        ],
      },
      {
        Icono: FinanzasIcon, titulo: "Finance", soloAdmin: true,
        pasos: [
          "Business tab: income, expenses and net of the SHARED markets only (Kollwitzplatz, Boxhagener Platz, Hackescher Markt), month by month and per market. Studio expenses are deducted automatically.",
          "Personal tab: each admin sees only their own markets (Marcello sees Mauerpark, Nuria sees RAW). Private.",
          "Expenses tab: record studio expenses (paper, rent, shipping...) with category; they flow into the business net.",
          "Historical incomes from the old app (April and May) are included and marked.",
        ],
      },
      {
        Icono: TareasIcon, titulo: "Tasks and coles", soloAdmin: true,
        pasos: [
          "Active: recurring maintenance tasks, they never end (completing one schedules the next date). Pending: one-off tasks.",
          "Each task has a difficulty: simple is 1 col, medium is 2, complex is 3 or 4.",
          "When you complete a task, choose who did it; that person's coles go down.",
          "Coles tab: everyone starts with 100 a month and the bars show how much each one has reduced, with the month-by-month history below. It's a studio game.",
          "Rotating tasks switch person automatically (e.g. market restock: 2 turns Marcello, then 2 turns Nuria).",
        ],
      },
      {
        Icono: TurnosIcon, titulo: "Shifts and calendar", soloAdmin: true,
        pasos: [
          "The calendar shows a dot on days with shifts. Tap a day to see them.",
          "Assign shift: date, start and end time, worker's name and EMAIL (anyone, even someone new), description.",
          "The worker gets an email with a calendar invite: opening it saves the shift to their phone's calendar.",
          "Save the worker's profile and next time you just pick them from the list.",
          "If you delete a future shift, the app offers to email a cancellation (it also removes the event from their calendar).",
        ],
      },
      {
        Icono: DespensaIcon, titulo: "Pantry", soloAdmin: true,
        pasos: [
          "The studio's supplies inventory: inks, paper, cards, stickers, envelopes...",
          "Update quantities; when something drops below its minimum it's flagged red as 'to buy' automatically.",
          "Add new supplies with '+ Add supply' and remove old ones with the ×.",
          "Send the purchase list to the team by email when there are alerts.",
        ],
      },
      {
        Icono: StatsIcon, titulo: "Stats", soloAdmin: true,
        pasos: [
          "Product metrics for ALL markets together (including Mauerpark and RAW): best-selling posters, sales by month, by market, by series.",
          "Money is separated in Finance; Stats is about units and designs.",
        ],
      },
      {
        Icono: EquipoIcon, titulo: "Team", soloAdmin: true,
        pasos: [
          "Create users with name and a 4-digit PIN. Role: admin or employee.",
          "Per-user stock permission: enable 'can count stock' and pick WHICH markets they may edit.",
          "Deactivate a user when someone leaves the team.",
        ],
      },
    ];
  }
  return [
    {
      Icono: LlaveIcon, titulo: "Entrar a la app",
      pasos: [
        "Abre la app y toca tu nombre.",
        "Escribe tu PIN de 4 dígitos.",
        "Con el botón EN/ES de arriba cambias el idioma cuando quieras.",
      ],
    },
    {
      Icono: CierreIcon, titulo: "Cierre: al acabar el mercado",
      intro: "Cuando termina tu turno, cierra el mercado: registra lo vendido según tu hoja de inventario del stand.",
      pasos: [
        "Entra a Cierre y toca Nuevo cierre.",
        "Elige qué mercado vas a cerrar, revisa la fecha y tu nombre.",
        "Toca 'Registrar ventas' y marca cuántos vendiste de cada póster (A4 / A3), tal como está en tu hoja de papel.",
        "Revisa el resumen y confirma: el stock se actualiza solo y el reporte llega por email al estudio.",
        "Si vendiste una comisión o alguien sugirió una idea, anótala en las notas antes de confirmar.",
      ],
      nota: "Si te equivocas, un admin puede editar o borrar el cierre después. Sin pánico.",
    },
    {
      Icono: BalanceIcon, titulo: "Balance: el dinero del día",
      intro: "Justo después del cierre, registra la plata para que las finanzas del estudio queden exactas.",
      pasos: [
        "Entra a Balance y rellena mercado, fecha y tu nombre.",
        "Si trabajaste por horas, elige 'Por horas trabajadas' y pon tus horas y tarifa.",
        "El float es el fondo de cambio con el que empezaste. NO es una venta.",
        "Gastos: el stand aparece solo; añade lo demás (transporte, etc.). Marca 'efectivo' si lo pagaste con plata del bolsillo.",
        "Ventas: SumUp (tarjeta), efectivo en bolsillo (cuéntalo SIN el float) y PayPal.",
        "Revisa el balance final y toca 'Guardar balance': el reporte se envía solo por email.",
      ],
    },
    {
      Icono: StockIcon, titulo: "Stock: contar inventario",
      pasos: [
        "Siempre puedes VER el stock de cualquier mercado.",
        "Para EDITAR un conteo necesitas permiso: un admin te habilita el acceso a un mercado concreto, normalmente cuando te pide contarlo.",
        "Elige el mercado, actualiza las cantidades y se guardan solas.",
      ],
      nota: "Los admins también encuentran aquí el Restock (sumar pósters recién impresos al stock).",
    },
    {
      Icono: FeedbackIcon, titulo: "Feedback BETA: tu opinión mejora esta app",
      intro: "Esta app está en beta. Si algo falla, te confunde o se puede mejorar, cuéntanoslo. Lo leemos todo.",
      pasos: [
        "Toca el botón BETA arriba en cualquier pantalla (el de los colores que cambian).",
        "Escribe lo que pasó, o toca el micrófono y DILO hablando.",
        "Junto al micrófono, elige el idioma en el que vas a hablar (ES, EN, HI, DE, IT, CA): usa tu idioma nativo, el que te salga natural. Nosotros lo traducimos.",
        "Toca 'Enviar feedback'. Listo: le llega directo a Marcello y Nuria.",
      ],
      nota: "El feedback guarda la sección de la app donde estás al enviarlo. Mándalo desde la pantalla donde viste el problema: así sabremos exactamente de qué parte hablas.",
      destacada: true,
    },
    {
      Icono: HomeIcon, titulo: "Inicio: el dashboard", soloAdmin: true,
      pasos: [
        "Alertas activas: pósters agotados, stock bajo, samples que faltan e insumos por acabarse.",
        "Pendientes de comprar y los últimos cierres de mercado, de un vistazo.",
      ],
    },
    {
      Icono: FinanzasIcon, titulo: "Finanzas", soloAdmin: true,
      pasos: [
        "Pestaña Negocio: ingresos, gastos y neto SOLO de los mercados compartidos (Kollwitzplatz, Boxhagener Platz, Hackescher Markt), por mes y por mercado. Los gastos del estudio se descuentan solos.",
        "Pestaña Personal: cada admin ve solo sus mercados (Marcello ve Mauerpark, Nuria ve RAW). Privado.",
        "Pestaña Gastos: registra los gastos del estudio (papel, alquiler, envíos...) con su categoría; entran al neto del negocio.",
        "Los ingresos históricos de la app anterior (abril y mayo) están incluidos y marcados.",
      ],
    },
    {
      Icono: TareasIcon, titulo: "Tareas y coles", soloAdmin: true,
      pasos: [
        "Activas: tareas recurrentes de mantenimiento, no se acaban (al completarlas saltan a la siguiente fecha). Pendientes: tareas puntuales.",
        "Cada tarea tiene dificultad: simple resta 1 col, media 2, compleja 3 o 4.",
        "Al completar una tarea eliges quién la hizo; a esa persona se le restan las coles.",
        "Pestaña Coles: cada uno parte con 100 al mes y las barras muestran cuánto ha reducido cada uno, con el historial mes a mes debajo. Es un juego del estudio.",
        "Las tareas rotativas cambian de persona solas (ej. rellenar mercados: 2 turnos Marcello y luego 2 turnos Nuria).",
      ],
    },
    {
      Icono: TurnosIcon, titulo: "Turnos y calendario", soloAdmin: true,
      pasos: [
        "El calendario marca con un punto los días con turno. Toca un día para verlos.",
        "Asignar turno: fecha, hora de inicio y fin, nombre y CORREO del trabajador (cualquiera, incluso alguien nuevo), descripción.",
        "Al trabajador le llega un email con invitación de calendario: al abrirla, el turno se guarda en el calendario de su teléfono.",
        "Guarda el perfil del trabajador y la próxima vez solo lo eliges de la lista.",
        "Si eliminas un turno futuro, la app ofrece avisar por correo (y borra el evento de su calendario).",
      ],
    },
    {
      Icono: DespensaIcon, titulo: "Despensa", soloAdmin: true,
      pasos: [
        "El inventario de supplies del estudio: tintas, papel, tarjetas, stickers, sobres...",
        "Actualiza cantidades; cuando algo baja de su mínimo se marca en rojo como 'comprar' automáticamente.",
        "Añade insumos nuevos con '+ Añadir insumo' y elimina los viejos con la ×.",
        "Envía la lista de compras al equipo por email cuando haya alertas.",
      ],
    },
    {
      Icono: StatsIcon, titulo: "Stats", soloAdmin: true,
      pasos: [
        "Métricas de producto de TODOS los mercados juntos (incluidos Mauerpark y RAW): pósters más vendidos, ventas por mes, por mercado, por serie.",
        "El dinero va separado en Finanzas; Stats es de unidades y diseños.",
      ],
    },
    {
      Icono: EquipoIcon, titulo: "Equipo", soloAdmin: true,
      pasos: [
        "Crea usuarios con nombre y PIN de 4 dígitos. Rol: admin o empleado.",
        "Permiso de stock por usuario: activa 'puede contar stock' y elige QUÉ mercados puede editar.",
        "Desactiva un usuario cuando alguien deja el equipo.",
      ],
    },
  ];
}

export default function GuiaPage() {
  const { user } = useAuth();
  const { lang } = useLang();

  const esAdmin = user?.rol === "admin";
  const todas = secciones(lang);
  const visibles = esAdmin ? todas : todas.filter((s) => !s.soloAdmin);

  const titulo = lang === "es" ? "Guía de la app" : "App guide";
  const subtitulo = lang === "es"
    ? "Cómo funciona cada parte, paso a paso"
    : "How every part works, step by step";
  const adminBadge = lang === "es" ? "solo admins" : "admins only";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{titulo}</h1>
        <p className="text-gray-500 text-sm">{subtitulo}</p>
      </div>

      {visibles.map((s) => (
        <div
          key={s.titulo}
          className={`rounded-2xl p-4 space-y-3 border ${s.destacada ? "bg-gray-900 border-gray-900" : "bg-white border-gray-200"}`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className={`flex items-center gap-2 text-sm font-bold ${s.destacada ? "text-white" : "text-gray-900"}`}>
              <span className={s.destacada ? "icono-tornasol" : "text-gray-400"}><s.Icono /></span>
              {s.destacada ? <span className="texto-tornasol">{s.titulo}</span> : s.titulo}
            </p>
            {s.soloAdmin && (
              <span className="shrink-0 text-[10px] text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{adminBadge}</span>
            )}
          </div>
          {s.intro && (
            <p className={`text-xs ${s.destacada ? "text-gray-300" : "text-gray-500"}`}>{s.intro}</p>
          )}
          <ol className="space-y-1.5">
            {s.pasos.map((p, i) => (
              <li key={i} className={`flex gap-2 text-sm ${s.destacada ? "text-gray-200" : "text-gray-700"}`}>
                <span className={`shrink-0 w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center ${s.destacada ? "bg-white/10 text-white" : "bg-gray-100 text-gray-500"}`}>
                  {i + 1}
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ol>
          {s.nota && (
            <p className={`text-[11px] rounded-lg px-3 py-2 ${s.destacada ? "bg-white/10 text-gray-300" : "bg-amber-50 text-amber-700"}`}>
              {s.nota}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
