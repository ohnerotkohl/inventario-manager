import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Nav from "./components/Nav";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ohne Rotkohl",
  description: "Inventory Management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={geist.className}>
      <body className="bg-gray-50 min-h-screen pb-20">
        <header className="bg-black px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <img
            src="https://cdn.shopify.com/s/files/1/0955/8471/5077/files/logo-Blanco.png?v=1776366740"
            alt="Ohne Rotkohl"
            className="h-7"
          />
          <span className="text-xs text-gray-400 uppercase tracking-widest">Inventario Manager</span>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-6">{children}</main>
        <Nav />
      </body>
    </html>
  );
}
