"use client";
import { useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { useLang } from "./LangProvider";

// Sets default language based on role on login.
// Employees → EN, Admins → ES.
// If the user manually changes language mid-session, that is respected
// until the next login.
export default function LangSetter() {
  const { user } = useAuth();
  const { setLang } = useLang();

  useEffect(() => {
    if (!user) return;
    setLang(user.rol === "empleado" ? "en" : "es");
  }, [user?.id]);

  return null;
}
