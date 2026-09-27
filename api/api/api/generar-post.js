// Genera 2 propuestas de texto para un posteo de Instagram, a partir de los
// datos de una orden ya terminada. No incluye datos del cliente (nombre,
// teléfono, matrícula/patente) para no publicar información privada.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Falta configurar ANTHROPIC_API_KEY en Vercel" });

  const { rubro, equipo, motor, trabajos, resumenesFotos, tono } = req.body || {};
  const rubroTxt = rubro === "motos" ? "motos" : rubro === "autos" ? "autos" : "náutica";

  const prompt = `Sos el community manager de un taller mecánico de ${rubroTxt} en Argentina. Con estos datos de un trabajo YA TERMINADO, armá contenido para un posteo de Instagram.

Equipo (sin datos del dueño): ${equipo || "no especificado"}
Motor: ${motor || "no especificado"}
Trabajos realizados: ${trabajos || "no especificado"}
Lo que muestran las fotos: ${(resumenesFotos || []).join(" | ") || "no hay descripciones"}
Estilo pedido: ${tono === "cercano" ? "cercano, informal, con algo de humor, como para redes de un taller de barrio" : "profesional y técnico, que transmita confianza"}

Nunca inventes datos técnicos que no te di. No menciones nombres de clientes, teléfonos, matrículas ni patentes.

Devolvé SOLO un objeto JSON con esta forma exacta:
{"variantes":[{"texto":"..."},{"texto":"..."}]}
Cada "texto" es un posteo completo lista para pegar: 2 a 4 líneas de texto, un salto de línea, y después 5 a 8 hashtags en español relacionados con ${rubroTxt} y mecánica.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 700,
        messages: [{ role: "user", content: prompt }]
      })
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
