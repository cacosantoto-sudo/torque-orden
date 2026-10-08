// Función de servidor (Vercel la publica sola en /api/leer-lista-precios).
// Lee una lista de precios de un proveedor (foto, PDF, o el texto de una planilla Excel/CSV)
// con la API de Claude y devuelve el proveedor y los artículos con código, descripción,
// precio y familia, para que el taller los revise antes de guardarlos. No guarda nada.
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

function instrucciones(familias, proveedores) {
  const fams = (familias || []).slice(0, 60).map(f => String(f || "").slice(0, 60)).filter(Boolean);
  const provs = (proveedores || []).slice(0, 300).map(p => `- ${String(p || "").slice(0, 80)}`).join("\n");
  return `Sos asistente administrativo de un taller mecánico en Argentina. Te paso una LISTA DE PRECIOS de un proveedor (o una parte de ella). Extraé el proveedor y cada artículo con su precio.

Devolvé SOLO un objeto JSON, sin texto antes ni después, con esta forma exacta:
{"proveedor": "nombre o razón social del proveedor que emite la lista, o null", "cuit": "CUIT del proveedor o null", "items": [["código", "descripción", 1234.5, "FAMILIA"]]}

Cada artículo es un arreglo de 4 valores, en este orden:
1. código del artículo tal como figura en la lista (o null si no tiene)
2. descripción completa (incluí marca, medida o presentación si figuran: "Aceite Elaion F50 5W40 x 4 L")
3. precio unitario como número con punto decimal, sin $ ni separador de miles (o null si no figura)
4. familia: una de estas, escrita igual: ${fams.length ? fams.join(", ") : "LUBRICANTES, NEUMÁTICOS, BATERÍAS, REPUESTOS DE MOTOR, HERRAMIENTAS, INSUMOS DE TALLER"}. Si ninguna corresponde, null.

Reglas:
- Si la lista tiene varias columnas de precio, usá el precio de lista unitario (sin IVA si está discriminado, y no el precio por caja o bulto).
- Los números argentinos usan punto para miles y coma para decimales: "12.345,67" es 12345.67.
- No incluyas títulos, encabezados, subtotales, notas ni condiciones de venta como artículos.
- No inventes artículos ni precios. Si un dato no se lee con certeza, poné null.
${provs ? `- Estos son los proveedores que el taller ya tiene cargados; si la lista es de uno de ellos, usá exactamente ese nombre:\n${provs}` : ""}`;
}

// Si la respuesta se cortó por largo, se rescatan los artículos completos que llegaron
function rescatar(salida) {
  const desde = salida.indexOf("{");
  if (desde < 0) return null;
  const t = salida.slice(desde);
  try { return JSON.parse(t.slice(0, t.lastIndexOf("}") + 1)); } catch (e) { /* sigue abajo */ }
  const corte = t.lastIndexOf("],");
  if (corte < 0) return null;
  try { return JSON.parse(t.slice(0, corte + 1) + "]}"); } catch (e) { return null; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Falta configurar ANTHROPIC_API_KEY en Vercel" });

  const { archivo, tipo, texto, taller_id, access_token, familias, proveedores } = req.body || {};
  const hayTexto = typeof texto === "string" && texto.trim();
  if (!hayTexto && (!archivo || !TIPOS.includes(tipo))) return res.status(400).json({ error: "Mandá una foto, un PDF o una planilla." });
  if (hayTexto && texto.length > 40000) return res.status(400).json({ error: "El texto es muy largo. Mandalo en partes." });

  if (!(await tienePlanOro(taller_id, access_token))) {
    return res.status(403).json({ error: "Leer listas de precios con IA es parte del plan Oro." });
  }

  const contenido = [];
  if (hayTexto) contenido.push({ type: "text", text: "Lista de precios:\n\n" + texto.trim() });
  else contenido.push(tipo === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: archivo } }
    : { type: "image", source: { type: "base64", media_type: tipo, data: archivo } });
  contenido.push({ type: "text", text: instrucciones(familias, proveedores) });

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
    if (data.stop_reason === "refusal") return res.status(422).json({ error: "No se pudo leer esta lista. Cargala a mano." });

    const salida = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    const json = rescatar(salida);
    if (!json) return res.status(500).json({ error: "No se entendió la respuesta. Probá de nuevo." });
    const items = (Array.isArray(json.items) ? json.items : [])
      .filter(it => Array.isArray(it) && it[1])
      .map(it => ({
        codigo: it[0] == null ? null : String(it[0]).slice(0, 60),
        descripcion: String(it[1]).slice(0, 200),
        precio: Number.isFinite(Number(it[2])) && it[2] !== null ? Number(it[2]) : null,
        familia: it[3] == null ? null : String(it[3]).slice(0, 60)
      }));
    return res.status(200).json({
      proveedor: json.proveedor || null,
      cuit: json.cuit || null,
      items,
      incompleto: data.stop_reason === "max_tokens"
    });
  } catch (e) {
    return res.status(500).json({ error: "No se pudo contactar a la API de Claude" });
  }
}
