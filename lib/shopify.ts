// Conexión con la Admin API de Shopify. SOLO servidor (rutas de /app/api):
// el ID y el secreto viven en Vercel y nunca llegan al navegador.
//
// La app se creó en el Dev Dashboard de Shopify (las "apps personalizadas" del
// admin ya no se pueden crear desde 2026). Con el "client credentials grant" se
// cambia ID + secreto por una clave que dura 24 h; se guarda en memoria y se
// pide otra cuando está por caducar.

const API_VERSION = "2026-10";

let token: string | null = null;
let caduca = 0;

export function shopifyConfigurado(): boolean {
  return !!(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET);
}

// "mi-tienda.myshopify.com", aunque en Vercel se pegue con https:// o con / al final
function tienda(): string {
  return (process.env.SHOPIFY_STORE_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

async function getToken(): Promise<string> {
  // margen de 5 min para no usar una clave a punto de caducar
  if (token && Date.now() < caduca - 5 * 60 * 1000) return token;
  const res = await fetch(`https://${tienda()}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.SHOPIFY_CLIENT_ID || "",
      client_secret: process.env.SHOPIFY_CLIENT_SECRET || "",
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Shopify no dio la clave de acceso (${res.status})`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  token = json.access_token;
  caduca = Date.now() + json.expires_in * 1000;
  return token;
}

export async function shopifyGraphQL<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`https://${tienda()}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": await getToken() },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Shopify respondió ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  return json.data as T;
}
