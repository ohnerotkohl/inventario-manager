import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Nav from "./components/Nav";
import AuthProvider from "./components/AuthProvider";
import Header from "./components/Header";
import LangProvider from "./components/LangProvider";
import LangSetter from "./components/LangSetter";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ohne Rotkohl",
  description: "Inventory Management",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Inventario",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={geist.className}>
      <body className="bg-gray-50 min-h-screen pb-20">
        <LangProvider>
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
