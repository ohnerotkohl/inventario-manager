# Activar la seguridad de la app — guía paso a paso

Esto cierra el agujero grave: hoy cualquiera puede leer/borrar los datos sin
login. Lo hacemos en **2 fases** para que el equipo nunca se quede fuera.

El **teclado de PIN sigue igual** para tu equipo. Todo el cambio es por debajo.

---

## Antes de empezar necesitas 3 datos de Supabase

### 1. La clave secreta del servidor (service_role)
1. Entra en **supabase.com** → tu proyecto.
2. Menú **Settings** (rueda dentada) → **API**.
3. Busca **Project API keys** → la fila **`service_role`** → **Reveal** → cópiala.
   - ⚠️ Esta clave es como la llave maestra. **Nunca** la pegues en un chat, web
     pública, ni en un archivo que empiece por `NEXT_PUBLIC`.

### 2. Crear la "cuenta compartida" de la app
1. En Supabase → menú **Authentication** → **Users** → **Add user** →
   **Create new user**.
2. Email: algo tipo `app@ohnerotkohl.com` (no hace falta que sea real, pero
   apúntalo). Password: una contraseña larga inventada (apúntala).
3. Marca **Auto Confirm User** (o "Confirm email") para que quede confirmada.
4. Crea el usuario.

### 3. Tienes ya, apuntados:
- `SUPABASE_SERVICE_ROLE_KEY` = la clave del paso 1
- `APP_AUTH_EMAIL` = el email del paso 2
- `APP_AUTH_PASSWORD` = la contraseña del paso 2

---

## FASE 1 — Poner el login nuevo (sin riesgo, la app sigue funcionando)

### A) Añadir los 3 datos donde está publicada la app (Vercel)
1. Entra en **vercel.com** → tu proyecto de la app.
2. **Settings** → **Environment Variables**.
3. Añade estas tres (una por una), para **Production** (y Preview si te deja):
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `APP_AUTH_EMAIL`
   - `APP_AUTH_PASSWORD`
4. Guarda.

### B) Desplegar el código nuevo
- Si publicas con `git push`, sube los cambios; Vercel redespliega solo.
- Cuando termine el despliegue, **prueba entrar** con tu PIN normal.

### C) Comprobar que todo va bien (importante)
- ✅ Entras con tu PIN igual que siempre.
- ✅ Se ven las ventas, el inventario, etc.
- ✅ Cierra sesión y vuelve a entrar: funciona.

👉 Si algo falla aquí, **NO pases a la Fase 2**. Avísame y lo revisamos. En esta
fase la protección aún no está activada, así que no hay peligro para los datos.

---

## FASE 2 — Activar la protección de la base de datos

Hazlo **solo cuando la Fase 1 funcione bien**.

1. En Supabase → menú **SQL Editor** → **New query**.
2. Abre el archivo `supabase-migrations/seguridad-rls.sql` de este proyecto,
   copia **todo** su contenido y pégalo.
3. Pulsa **Run**.
4. Vuelve a la app y **prueba de nuevo**: entrar con PIN, ver datos, guardar una
   prueba. Todo debe seguir funcionando.

### Si algo va mal en la Fase 2
Abre el `SQL Editor` otra vez y ejecuta el **bloque ROLLBACK** que está al final
de `seguridad-rls.sql` (viene en comentarios): desactiva la protección y la app
vuelve al estado anterior al instante. Luego me avisas.

---

## Qué queda cubierto y qué no (para que lo sepas)

**Cubierto:** nadie de fuera (sin login) puede leer ni tocar tus datos. Los PINs
ya no se pueden descifrar (nunca salen del servidor).

**Límite conocido:** como todo el equipo comparte la misma "llave" interna, la
diferencia entre admin y empleado sigue siendo a nivel de app (no la impone la
base de datos). Para un equipo pequeño de confianza es un salto enorme frente a
"cualquiera en internet". Si más adelante quieres blindar también eso, se puede,
pero es otro proyecto aparte.
