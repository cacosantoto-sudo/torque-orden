// Función de servidor (Vercel la publica sola en /api/leer-foto).
// Usa tu clave de la API de Claude, guardada como variable de entorno ANTHROPIC_API_KEY.
// El celular nunca ve esta clave: le habla a esta función, y esta función le habla a Claude.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Falta configurar ANTHROPIC_API_KEY en Vercel" });

  const { modo, rubro, texto, campos, imagen } = req.body || {};
  const rubroTxt = rubro === "motos" ? "motos" : rubro === "autos" ? "autos" : "náutica";

  let body;
  if (modo === "texto") {
    body = {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: `Sos asistente de un taller mecánico (${rubroTxt}) en Argentina. Del texto dictado por el mecánico extraé datos para una orden de trabajo. Devolvé SOLO un objeto JSON con estas claves (usá null si no se mencionó, no inventes nada): ${campos}. Texto: "${String(texto).slice(0, 4000).replace(/"/g, "'")}"`
      }]
    };
  } else if (modo === "foto") {
    body = {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imagen } },
          { type: "text", text: `Sos asistente de un taller mecánico (${rubroTxt}). Mirá la foto (chapa del motor, número de serie, patente, contador de horas o kilómetros, o el trabajo en sí). Devolvé SOLO un objeto JSON con: campos (objeto con las claves que puedas leer con certeza entre motor, serie, medidor; null si no se lee) y resumen (una frase corta en español).` }
        ]
      }]
    };
  } else {
    return res.status(400).json({ error: "Falta el modo (texto o foto)" });
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data.error?.message || "Error de la API de Claude" });

    const texto_ia = (data.content || []).map(b => b.text || "").join("");
    const limpio = texto_ia.replace(/```json|```/g, "").trim();
    let json;
    try { json = JSON.parse(limpio); } catch (e) { return res.status(500).json({ error: "Claude no devolvió un JSON válido" }); }
    return res.status(200).json(json);
  } catch (e) {
    return res.status(500).json({ error: "No se pudo contactar a la API de Claude" });
  }
}
