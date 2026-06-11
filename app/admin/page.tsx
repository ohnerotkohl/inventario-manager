"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { hashPin } from "@/lib/auth";
import { useAuth } from "@/app/components/AuthProvider";
import { useLang } from "@/app/components/LangProvider";

interface UsuarioRow {
  id: string;
  nombre: string;
  rol: "admin" | "empleado";
  puede_inventario: boolean;
  activo: boolean;
  // NULL = todas las cajas; array = solo esas
  cajas_permitidas: string[] | null;
}

interface CajaRow {
  id: string;
  nombre: string;
}

export default function AdminPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLang();
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [pin, setPin] = useState("");
  const [rol, setRol] = useState<"admin" | "empleado">("empleado");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [changePinId, setChangePinId] = useState<string | null>(null);
  const [newPin, setNewPin] = useState("");
  const [pinError, setPinError] = useState("");

  const [cajas, setCajas] = useState<CajaRow[]>([]);

  useEffect(() => {
    if (user && user.rol !== "admin") {
      router.replace("/");
      return;
    }
    fetchUsuarios();
    supabase.from("cajas").select("id, nombre").order("nombre").then(({ data }) => setCajas(data ?? []));
  }, [user]);

  async function fetchUsuarios() {
    const { data } = await supabase
      .from("usuarios")
      .select("*")
      .order("nombre");
    setUsuarios(data ?? []);
    setLoading(false);
  }

  async function toggleCajaPermitida(u: UsuarioRow, cajaId: string) {
    // NULL significa "todas": al quitar una, el set pasa a ser explícito
    const actual = u.cajas_permitidas ?? cajas.map((c) => c.id);
    const nuevas = actual.includes(cajaId)
      ? actual.filter((id) => id !== cajaId)
      : [...actual, cajaId];
    const { error: err } = await supabase.from("usuarios").update({ cajas_permitidas: nuevas }).eq("id", u.id);
    if (err) return;
    setUsuarios((prev) => prev.map((x) => x.id === u.id ? { ...x, cajas_permitidas: nuevas } : x));
    setSavedId(u.id);
    setTimeout(() => setSavedId(null), 2000);
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

  async function cambiarPin(id: string) {
    setPinError("");
    if (newPin.length !== 4) { setPinError(t.pinMustBe4Exact); return; }
    const pin_hash = await hashPin(newPin);
    const { error: err } = await supabase.from("usuarios").update({ pin_hash }).eq("id", id);
    if (err) { setPinError(err.message); return; }
    setChangePinId(null);
    setNewPin("");
    setSavedId(id);
    setTimeout(() => setSavedId(null), 2000);
  }

  async function crearUsuario() {
    if (!nombre.trim() || pin.length !== 4) {
      setError(t.nameAndPin4Required);
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

  if (loading) return <p className="text-gray-500 text-sm">{t.loading}</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t.team}</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm bg-black text-white px-4 py-2 rounded-xl"
        >
          {showForm ? t.cancel : t.addBtn}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
          <p className="font-semibold text-sm">{t.newUser}</p>
          <input
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-black"
            placeholder={t.name}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <input
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-black"
            placeholder={t.pin4digits}
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
            <option value="empleado">{t.employee}</option>
            <option value="admin">{t.admin}</option>
          </select>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button
            onClick={crearUsuario}
            disabled={saving}
            className="bg-black text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? t.saving : t.createUser}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {usuarios.map((u) => (
          <div
            key={u.id}
            className={`bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3 ${!u.activo ? "opacity-50" : ""}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{u.nombre}</p>
                <p className="text-xs text-gray-400 capitalize">{u.rol}</p>
              </div>
              <div className="flex items-center gap-2">
                {savedId === u.id && (
                  <span className="text-green-600 text-xs font-medium">✓ {t.saved}</span>
                )}
                <button
                  onClick={() => toggleActivo(u)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    u.activo
                      ? "border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-500"
                      : "border-green-300 text-green-600 hover:bg-green-50"
                  }`}
                >
                  {u.activo ? t.deactivate : t.activate}
                </button>
              </div>
            </div>

            {/* Cambiar PIN */}
            {changePinId === u.id ? (
              <div className="flex flex-col gap-2">
                <input
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-black"
                  placeholder={t.newPin}
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                />
                {pinError && <p className="text-red-500 text-xs">{pinError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => cambiarPin(u.id)}
                    className="flex-1 bg-black text-white rounded-xl py-2 text-xs font-medium"
                  >
                    {t.savePin}
                  </button>
                  <button
                    onClick={() => { setChangePinId(null); setNewPin(""); setPinError(""); }}
                    className="flex-1 border border-gray-200 rounded-xl py-2 text-xs text-gray-500"
                  >
                    {t.cancel}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setChangePinId(u.id); setNewPin(""); setPinError(""); }}
                className="text-xs text-gray-400 hover:text-black transition-colors text-left"
              >
                🔑 {t.changePin}
              </button>
            )}

            {u.rol === "empleado" && (
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={u.puede_inventario}
                    onChange={() => toggleInventario(u)}
                    className="w-4 h-4 rounded"
                  />
                  {t.canCountStock}
                </label>
                {u.puede_inventario && (
                  <div className="pl-6">
                    <p className="text-xs text-gray-400 mb-1.5">{t.allowedBoxes}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {cajas.map((c) => {
                        const permitida = !u.cajas_permitidas || u.cajas_permitidas.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            onClick={() => toggleCajaPermitida(u, c.id)}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                              permitida
                                ? "bg-black text-white border-black"
                                : "bg-white text-gray-400 border-gray-200 hover:border-gray-400"
                            }`}
                          >
                            {c.nombre}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
