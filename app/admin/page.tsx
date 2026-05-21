"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { hashPin } from "@/lib/auth";
import { useAuth } from "@/app/components/AuthProvider";

interface UsuarioRow {
  id: string;
  nombre: string;
  rol: "admin" | "empleado";
  puede_inventario: boolean;
  activo: boolean;
}

export default function AdminPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [pin, setPin] = useState("");
  const [rol, setRol] = useState<"admin" | "empleado">("empleado");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.rol !== "admin") {
      router.replace("/");
      return;
    }
    fetchUsuarios();
  }, [user]);

  async function fetchUsuarios() {
    const { data } = await supabase
      .from("usuarios")
      .select("id, nombre, rol, puede_inventario, activo")
      .order("nombre");
    setUsuarios(data ?? []);
    setLoading(false);
  }

  async function toggleActivo(u: UsuarioRow) {
    await supabase.from("usuarios").update({ activo: !u.activo }).eq("id", u.id);
    setUsuarios((prev) => prev.map((x) => x.id === u.id ? { ...x, activo: !u.activo } : x));
  }

  async function toggleInventario(u: UsuarioRow) {
    const nuevoValor = !u.puede_inventario;
    const { error: err } = await supabase.from("usuarios").update({ puede_inventario: nuevoValor }).eq("id", u.id);
    if (err) return;
    setUsuarios((prev) => prev.map((x) => x.id === u.id ? { ...x, puede_inventario: nuevoValor } : x));
    setSavedId(u.id);
    setTimeout(() => setSavedId(null), 2000);
  }

  async function crearUsuario() {
    if (!nombre.trim() || pin.length !== 4) {
      setError("Nombre y PIN de exactamente 4 dígitos son requeridos.");
      return;
    }
    setSaving(true);
    const pin_hash = await hashPin(pin);
    const { error: err } = await supabase.from("usuarios").insert({
      nombre: nombre.trim(),
      pin_hash,
      rol,
      puede_inventario: false,
      activo: true,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setNombre(""); setPin(""); setRol("empleado"); setShowForm(false); setError("");
    fetchUsuarios();
  }

  if (loading) return <p className="text-gray-500 text-sm">Cargando...</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Equipo</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm bg-black text-white px-4 py-2 rounded-xl"
        >
          {showForm ? "Cancelar" : "+ Añadir"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
          <p className="font-semibold text-sm">Nuevo usuario</p>
          <input
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-black"
            placeholder="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <input
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-black"
            placeholder="PIN (4 dígitos)"
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
          <select
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-black"
            value={rol}
            onChange={(e) => setRol(e.target.value as "admin" | "empleado")}
          >
            <option value="empleado">Empleado</option>
            <option value="admin">Admin</option>
          </select>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button
            onClick={crearUsuario}
            disabled={saving}
            className="bg-black text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Crear usuario"}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {usuarios.map((u) => (
          <div
            key={u.id}
            className={`bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-2 ${!u.activo ? "opacity-50" : ""}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{u.nombre}</p>
                <p className="text-xs text-gray-400 capitalize">{u.rol}</p>
              </div>
              <button
                onClick={() => toggleActivo(u)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  u.activo
                    ? "border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-500"
                    : "border-green-300 text-green-600 hover:bg-green-50"
                }`}
              >
                {u.activo ? "Desactivar" : "Activar"}
              </button>
            </div>

            {u.rol === "empleado" && (
              <div className="flex flex-col gap-1">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={u.puede_inventario}
                    onChange={() => toggleInventario(u)}
                    className="w-4 h-4 rounded"
                  />
                  Puede hacer conteo de stock
                  {savedId === u.id && (
                    <span className="text-green-600 text-xs font-medium">✓ Guardado</span>
                  )}
                </label>
                {u.puede_inventario && (
                  <p className="text-xs text-gray-400 pl-6">
                    El empleado debe cerrar sesión y volver a entrar para que aplique.
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
