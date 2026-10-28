import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { shopifyConfigurado, shopifyGraphQL } from "@/lib/shopify";

export const dynamic = "force-dynamic";

// Pedidos de Shopify pendientes de enviar, para rellenar la etiqueta de envío.
// Devuelve direcciones de clientes, así que exige la sesión de Supabase de la app
// (el mismo token con el que la app lee la base). No se guarda nada: se pide a
// Shopify en el momento.

type Direccion = {
  name: string | null; company: string | null;
  address1: string | null; address2: string | null;
  zip: string | null; city: string | null;
  country: string | null; countryCodeV2: string | null;
};
type PedidoShopify = {
  id: string; name: string; createdAt: string;
  cancelledAt: string | null;
  displayFulfillmentStatus: string;
  shippingAddress: Direccion | null;
  lineItems: { nodes: { title: string; variantTitle: string | null; quantity: number }[] };
};

const QUERY = `
  query Pedidos {
    orders(first: 50, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id name createdAt cancelledAt displayFulfillmentStatus
        shippingAddress { name company address1 address2 zip city country countryCodeV2 }
        lineItems(first: 10) { nodes { title variantTitle quantity } }
      }
    }
  }
`;

// Estados en los que el pedido todavía hay que enviarlo
const PENDIENTES = new Set(["UNFULFILLED", "PARTIALLY_FULFILLED", "IN_PROGRESS", "ON_HOLD", "SCHEDULED", "OPEN", "PENDING_FULFILLMENT"]);

export async function GET(req: NextRequest) {
  // 1) Sesión de la app
  const auth = req.headers.get("authorization") || "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!jwt || !url || !anon) return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  const { data: u, error: authErr } = await createClient(url, anon, { auth: { persistSession: false } }).auth.getUser(jwt);
  if (authErr || !u?.user) return NextResponse.json({ error: "no_autorizado" }, { status: 401 });

  // 2) Shopify
  if (!shopifyConfigurado()) return NextResponse.json({ error: "no_configurado" }, { status: 503 });
  try {
    const data = await shopifyGraphQL<{ orders: { nodes: PedidoShopify[] } }>(QUERY);
    const pedidos = data.orders.nodes
      .filter((o) => !o.cancelledAt && PENDIENTES.has(o.displayFulfillmentStatus) && o.shippingAddress)
      .map((o) => {
        const d = o.shippingAddress!;
        return {
          id: o.id,
          numero: o.name,
          fecha: o.createdAt.slice(0, 10),
          nombre: [d.name, d.company].filter(Boolean).join(", "),
          calle: [d.address1, d.address2].filter(Boolean).join(", "),
          cpCiudad: [d.zip, d.city].filter(Boolean).join(" "),
          // Para Alemania no hace falta poner el país en la etiqueta
          pais: d.countryCodeV2 && d.countryCodeV2 !== "DE" ? (d.country || d.countryCodeV2).toUpperCase() : "",
          articulos: o.lineItems.nodes.map((l) => ({
            titulo: l.variantTitle ? `${l.title} (${l.variantTitle})` : l.title,
            cantidad: l.quantity,
          })),
        };
      });
    return NextResponse.json({ pedidos });
  } catch (e) {
    console.error("Shopify pedidos:", e);
    return NextResponse.json({ error: "shopify", detalle: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
