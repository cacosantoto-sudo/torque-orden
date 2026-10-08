// Función de servidor (Vercel la publica sola en /api/cuenta-corriente-ia).
// Lee comprobantes o resúmenes de cuenta de proveedores (foto, PDF o texto pegado) con
// la API de Claude y devuelve la lista de compras y pagos que encuentra, para que el
// taller la revise y la corrija antes de confirmarla. No guarda nada por sí misma.
// Usa la variable de entorno ANTHROPIC_API_KEY. Tiene costo por uso: solo plan Oro.

export const config = { maxDuration: 60 };

// Las funciones con IA tienen costo por uso: son parte del plan Oro.
async function tienePlanOro(tallerId, accessToken) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key || !tallerId || !accessToken) return false;
  try {
    const r = await fetch(`${url}/rest/v1/talleres?id=eq.${encodeURIComponent(tallerId)}&select=plan`, {
      headers: { apikey: key, Authorization: `Bearer ${accessToken}` }
    });
    if (!r.ok) return false;
    const rows = await r.json();
    // "pago" es el nombre viejo del plan con IA, antes de que hubiera plata y oro.
    return rows[0]?.plan === "oro" || rows[0]?.plan === "pago";
  } catch (e) { return false; }
}

const TIPOS = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

function instrucciones(taller, proveedores) {
  const lista = (proveedores || []).slice(0, 300)
    .map(p => `- ${String(p.nombre || "").slice(0, 80)}${p.cuit ? ` (CUIT ${String(p.cuit).slice(0, 20)})` : ""}`).join("\n");
  return `Sos asistente administrativo de un taller mecánico en Argentina${taller ? ` llamado "${String(taller).slice(0, 80)}"` : ""}. Te paso material de las cuentas corrientes con sus PROVEEDORES: puede ser una factura, un remito, una nota de crédito, un recibo u orden de pago, un comprobante de transferencia, un resumen o estado de cuenta del proveedor, o un texto/planilla con varias operaciones.

Extraé cada operación por separado. Tipos:
- "compra": factura, remito valorizado o nota de débito del proveedor (aumenta lo que el taller le debe).
- "pago": pago del taller al proveedor (recibo, orden de pago, transferencia, cheque, efectivo). Disminuye la deuda.
- "nota_credito": nota de crédito o devolución del proveedor. Disminuye la deuda.

En un resumen de cuenta, cada renglón es una operación. NO incluyas renglones de "saldo anterior", "saldo", subtotales ni totales del resumen.
El proveedor es la empresa que vende al taller (no el taller). ${lista ? `Estos son los proveedores que el taller ya tiene cargados; si la operación es de uno de ellos, usá exactamente ese nombre:\n${lista}` : "El taller todavía no tiene proveedores cargados."}

Devolvé SOLO un objeto JSON, sin texto antes ni después, con esta forma exacta:
{
  "operaciones": [
    {
      "tipo": "compra | pago | nota_credito",
      "proveedor": "nombre o razón social del proveedor",
      "cuit": "CUIT del proveedor o null",
      "numero": "número de comprobante (factura, recibo, NC, transferencia) o null",
      "fecha": "AAAA-MM-DD",
      "vencimiento": "AAAA-MM-DD o null (solo compras)",
      "importe": 0,
      "medio_pago": "efectivo | transferencia | cheque | tarjeta | null (solo pagos)",
      "observaciones": "dato útil corto (banco, nº de cheque, concepto) o null"
    }
  ]
}

Reglas:
- "importe" es siempre positivo, con punto decimal (12345.67), sin $ ni separador de miles. Es el total final de la operación.
- Las fechas del material están en formato argentino (día/mes/año).
- Si un dato no figura o no se lee con certeza, poné null. No inventes operaciones ni importes.
- Si no hay ninguna operación, devolvé {"operaciones": []}.`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Falta configurar ANTHROPIC_API_KEY en Vercel" });

  const { archivo, tipo, texto, taller_id, access_token, taller, proveedores } = req.body || {};
  const hayTexto = typeof texto === "string" && texto.trim();
  if (!hayTexto && (!archivo || !TIPOS.includes(tipo))) return res.status(400).json({ error: "Mandá una foto, un PDF o pegá el texto." });
  if (hayTexto && texto.length > 30000) return res.status(400).json({ error: "El texto es muy largo. Pegalo en partes." });

  if (!(await tienePlanOro(taller_id, access_token))) {
    return res.status(403).json({ error: "Cargar cuentas corrientes con IA es parte del plan Oro." });
  }

  const contenido = [];
  if (hayTexto) contenido.push({ type: "text", text: "Material:\n\n" + texto.trim() });
  else contenido.push(tipo === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: archivo } }
    : { type: "image", source: { type: "base64", media_type: tipo, data: archivo } });
  contenido.push({ type: "text", text: instrucciones(taller, Array.isArray(proveedores) ? proveedores : []) });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "server-side-fallback-2026-07-01"
      },
      body: JSON.stringify({
        model: "claude-opus-5-5",
        max_tokens: 16000,
        output_config: { effort: "low" },
        fallbacks: "default",
        messages: [{ role: "user", content: contenido }]
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data.error?.message || "Error de la API de Claude" });
    if (data.stop_reason === "refusal") return res.status(422).json({ error: "No se pudo leer este material. Cargalo a mano." });

    const salida = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    const desde = salida.indexOf("{"), hasta = salida.lastIndexOf("}");
    let json;
    try { json = JSON.parse(salida.slice(desde, hasta + 1)); } catch (e) { return res.status(500).json({ error: "No se entendió la respuesta. Probá de nuevo." }); }
    const ops = (Array.isArray(json.operaciones) ? json.operaciones : [])
      .filter(o => o && ["compra", "pago", "nota_credito"].includes(o.tipo) && Number(o.importe) > 0);
    return res.status(200).json({ operaciones: ops });
  } catch (e) {
    return res.status(500).json({ error: "No se pudo contactar a la API de Claude" });
  }
}
