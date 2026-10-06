// Función de servidor (Vercel la publica sola en /api/leer-comprobante).
// Lee una factura de compra de un proveedor (foto o PDF) con la API de Claude y
// devuelve los datos en JSON para que el taller los revise antes de guardarlos.
// Usa la misma clave que las otras funciones: variable de entorno ANTHROPIC_API_KEY.
// Tiene un costo por uso, así que solo la pueden usar los talleres con plan pago.

export const config = { maxDuration: 60 };

async function tienePlanPago(tallerId, accessToken) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key || !tallerId || !accessToken) return false;
  try {
    const r = await fetch(`${url}/rest/v1/talleres?id=eq.${encodeURIComponent(tallerId)}&select=plan`, {
      headers: { apikey: key, Authorization: `Bearer ${accessToken}` }
    });
    if (!r.ok) return false;
    const rows = await r.json();
    return rows[0]?.plan === "pago";
  } catch (e) { return false; }
}

const TIPOS = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

const INSTRUCCIONES = `Sos asistente administrativo de un taller mecánico en Argentina. Leé este comprobante de compra (factura, remito o ticket de un proveedor) y extraé los datos.

Devolvé SOLO un objeto JSON, sin texto antes ni después, con esta forma exacta:
{
  "proveedor": "razón social del EMISOR del comprobante (el proveedor, no el taller que compra)",
  "cuit": "CUIT del emisor, con o sin guiones",
  "telefono": null,
  "email": null,
  "direccion": null,
  "numero": "número de comprobante, por ejemplo 0001-00012345 (incluí la letra si figura: A 0001-00012345)",
  "fecha": "AAAA-MM-DD",
  "vencimiento": "AAAA-MM-DD o null",
  "condicion_pago": "contado, cuenta corriente, 30 días, etc. o null",
  "total": 0,
  "items": [
    {"descripcion": "", "marca": null, "codigo": null, "cantidad": 1, "costo_unitario": 0, "total": 0}
  ]
}

Reglas:
- Los importes van como números con punto decimal (12345.67), sin símbolo $ ni separador de miles.
- En los ítems poné el precio unitario y el total de la línea tal como figuran (si el comprobante discrimina IVA, usá los importes de la línea como aparecen).
- "total" es el importe total final del comprobante.
- Si un dato no figura o no se lee con certeza, poné null. No inventes nada.
- Las fechas del comprobante están en formato argentino (día/mes/año).`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Falta configurar ANTHROPIC_API_KEY en Vercel" });

  const { archivo, tipo, taller_id, access_token } = req.body || {};
  if (!archivo || !TIPOS.includes(tipo)) return res.status(400).json({ error: "Mandá una foto (JPG/PNG) o un PDF del comprobante." });

  if (!(await tienePlanPago(taller_id, access_token))) {
    return res.status(403).json({ error: "La lectura automática de comprobantes es parte del plan pago." });
  }

  const bloque = tipo === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: archivo } }
    : { type: "image", source: { type: "base64", media_type: tipo, data: archivo } };

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
        messages: [{ role: "user", content: [bloque, { type: "text", text: INSTRUCCIONES }] }]
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data.error?.message || "Error de la API de Claude" });
    if (data.stop_reason === "refusal") return res.status(422).json({ error: "No se pudo leer este comprobante. Cargalo a mano." });

    const texto = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    const desde = texto.indexOf("{"), hasta = texto.lastIndexOf("}");
    let json;
    try { json = JSON.parse(texto.slice(desde, hasta + 1)); } catch (e) { return res.status(500).json({ error: "No se entendió la respuesta. Probá de nuevo o cargalo a mano." }); }
    if (!Array.isArray(json.items)) json.items = [];
    return res.status(200).json(json);
  } catch (e) {
    return res.status(500).json({ error: "No se pudo contactar a la API de Claude" });
  }
}
