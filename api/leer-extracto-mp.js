// Función de servidor (Vercel la publica sola en /api/leer-extracto-mp).
// Lee el extracto (resumen de movimientos) de Mercado Pago, otra billetera virtual o una cuenta de banco en PDF
// con la API de Claude y devuelve la lista de movimientos para que el taller la revise
// antes de registrarla en su billetera. No guarda nada por sí misma.
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

function instrucciones(billetera, tipo) {
  const nombre = billetera ? ` ("${String(billetera).slice(0, 60)}")` : "";
  const origen = tipo === "banco"
    ? `Te paso el extracto o resumen de una cuenta bancaria${nombre} de un taller mecánico en Argentina, con columnas como Fecha, Concepto o Descripción, Comprobante o Referencia, Débito, Crédito y Saldo.`
    : `Te paso el extracto o resumen de movimientos de una billetera virtual${nombre} de un taller mecánico en Argentina, normalmente el "Resumen de cuenta" de Mercado Pago, con columnas como Fecha, Descripción, ID de la operación, Valor y Saldo.`;
  return `${origen}

Extraé TODOS los movimientos, uno por renglón, en el orden en que aparecen. NO incluyas renglones de saldo inicial, saldo final, subtotales, totales ni encabezados.

Devolvé SOLO un objeto JSON, sin texto antes ni después, con esta forma exacta (claves cortas para que entren todos):
{
  "periodo": "texto corto del período del extracto o null",
  "saldo_inicial": 0,
  "saldo_final": 0,
  "m": [
    { "f": "AAAA-MM-DD", "h": "HH:MM o null", "d": "descripción tal cual (ej.: Transferencia recibida Juan Pérez)", "r": "ID o número de operación o null", "i": 0 }
  ]
}

Reglas:
- "i" es el importe con signo: positivo si entra plata (crédito, cobro, transferencia recibida, depósito, venta, devolución), negativo si sale (débito, pago, transferencia enviada, retiro, comisión, impuesto, cargo).
- Importes con punto decimal (12345.67), sin $ ni separador de miles.
- Las fechas del extracto están en formato argentino (día/mes/año).
- "saldo_inicial" y "saldo_final" son los que figuran en el extracto; si no figuran, null.
- Si un dato no se lee con certeza, poné null. No inventes movimientos ni importes.
- Si no hay movimientos, devolvé "m": [].`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Falta configurar ANTHROPIC_API_KEY en Vercel" });

  const { archivo, taller_id, access_token, billetera, tipo } = req.body || {};
  if (!archivo || typeof archivo !== "string") return res.status(400).json({ error: "Mandá el PDF del extracto." });

  if (!(await tienePlanOro(taller_id, access_token))) {
    return res.status(403).json({ error: "Leer el extracto con IA es parte del plan Oro." });
  }

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
        messages: [{ role: "user", content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: archivo } },
          { type: "text", text: instrucciones(billetera, tipo) }
        ] }]
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data.error?.message || "Error de la API de Claude" });
    if (data.stop_reason === "refusal") return res.status(422).json({ error: "No se pudo leer este extracto. Cargá los movimientos a mano." });

    const salida = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    const cortado = data.stop_reason === "max_tokens";
    let json;
    try {
      const desde = salida.indexOf("{");
      // Si la respuesta se cortó por larga, se rescatan los movimientos completos
      json = JSON.parse(salida.slice(desde, salida.lastIndexOf("}") + 1) + (cortado ? "]}" : ""));
    } catch (e) { return res.status(500).json({ error: cortado ? "El extracto es muy largo. Bajalo de a una quincena o un mes y probá de nuevo." : "No se entendió la respuesta. Probá de nuevo." }); }
    const movimientos = (Array.isArray(json.m) ? json.m : [])
      .filter(x => x && Number(x.i) && /^\d{4}-\d\d-\d\d$/.test(x.f || ""))
      .map(x => ({ fecha: x.f, hora: /^\d\d:\d\d/.test(x.h || "") ? x.h.slice(0, 5) : null, descripcion: String(x.d || "Movimiento").slice(0, 200), referencia: x.r ? String(x.r).slice(0, 60) : null, importe: Number(x.i) }));
    const num = v => (v === null || v === undefined || v === "" || isNaN(Number(v))) ? null : Number(v);
    return res.status(200).json({
      periodo: json.periodo || null, saldo_inicial: num(json.saldo_inicial), saldo_final: num(json.saldo_final),
      movimientos, cortado
    });
  } catch (e) {
    return res.status(500).json({ error: "No se pudo contactar a la API de Claude" });
  }
}
