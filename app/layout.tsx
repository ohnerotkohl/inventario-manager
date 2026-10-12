import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Nav from "./components/Nav";
import AuthProvider from "./components/AuthProvider";
import Header from "./components/Header";
import LangProvider from "./components/LangProvider";
import LangSetter from "./components/LangSetter";
import Tema from "./components/Tema";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ohne Rotkohl",
  description: "Ohne Rotkohl Studio App",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Ohne Rotkohl",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

// La barra de arriba del móvil (hora, batería) va del mismo negro que el fondo, no blanca
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0b0c0f",
  // la cabecera llega hasta arriba del todo (detrás de la hora y la batería)
  viewportFit: "cover",
};

// Mismas reglas que components/Tema.tsx: las hojas de imprimir quedan en blanco;
// Inicio y la entrada ya eran oscuras (fondo morado sin invertir colores).
const TEMA_INICIAL = `(function(){var r=location.pathname,b="/"+(r.split("/")[1]||""),c=document.body.classList;
if(b==="/imprimir"||b==="/hoja-escaneo")return;c.add("tema");if(r!=="/"&&r!=="/login")c.add("invertir");})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={geist.className}>
      <body className="bg-gray-50 min-h-screen pb-20" suppressHydrationWarning>
        {/* Activa el tema morado antes de pintar nada, para que al abrir la app no
            aparezca un instante el diseño antiguo (blanco con puntitos) */}
        <script dangerouslySetInnerHTML={{ __html: TEMA_INICIAL }} />
        <LangProvider>
        {/* el fondo animado no espera a comprobar la sesión: está desde el primer momento */}
        <Tema />
        <AuthProvider>
          <LangSetter />
          <Header />
          <main className="max-w-2xl mx-auto px-4 py-6">{children}</main>
          <Nav />
        </AuthProvider>
        </LangProvider>
      </body>
    </html>
  );
}
