import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 4000;
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .map((origin) => origin.replace(/\/$/, ""))
  .filter(Boolean);
app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  if (!requestOrigin || allowedOrigins.includes(requestOrigin.replace(/\/$/, "")) || !allowedOrigins.length) {
    res.header("Access-Control-Allow-Origin", requestOrigin || "*");
  }
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(cors({
  origin: allowedOrigins.length
    ? (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin.replace(/\/$/, "")))
    : true
}));
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, provider: process.env.GEMINI_API_KEY ? "gemini" : "not-configured" });
});

async function generateWithGemini(prompt) {
  if (!process.env.GEMINI_API_KEY) throw new Error("AI provider is not configured");
  const configuredModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const models = [...new Set([
    configuredModel,
    "gemini-2.5-flash"
  ])].filter(Boolean);
  let lastStatus = 500;
  let lastError = "";

  for (const model of models) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: { responseMimeType: "application/json" },
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    if (response.ok) {
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("");
      const json = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      return JSON.parse(json);
    }
    lastStatus = response.status;
    const providerError = await response.json().catch(() => null);
    lastError = providerError?.error?.message || "";
    if (![404, 400].includes(response.status)) break;
  }

  throw new Error(`Gemini request failed (${lastStatus})${lastError ? `: ${lastError}` : ""}`);
}

app.post("/api/study-guide", async (req, res) => {
  const { title = "Study kit", difficulty = "Intermediate", materials = [], sourceText = "" } = req.body;
  const source = sourceText.trim();
  try {
    if (!source) throw new Error("No material text was provided");
    const prompt = `Create concise, detailed study notes from the uploaded class material for "${title}" at ${difficulty} level.

Use only the supplied material. Identify the real lecture topics and explain every important idea.
Return only valid JSON:
{"title":"topic-based title","overview":"short summary of the material","sections":[{"heading":"actual topic","content":"clear explanation","points":["important bullet point","another bullet point"],"keyTerms":[{"term":"key term","meaning":"meaning"}]}],"quickRevision":["revision point 1","revision point 2"]}

Make key terms and important facts bold using Markdown **double asterisks** inside strings. Do not use generic headings or invented content.

Uploaded material:
${source.slice(0, 120000)}`;
    const generated = await generateWithGemini(prompt);
    if (!generated?.overview || !Array.isArray(generated.sections)) throw new Error("Invalid AI response");
    res.json({ provider: "gemini", guide: { title, difficulty, ...generated, sourceCount: materials.length } });
  } catch (error) {
    console.error("AI guide generation failed:", error.message);
    const providerNotConfigured = error.message === "AI provider is not configured";
    res.status(providerNotConfigured ? 503 : 502).json({
      error: providerNotConfigured
        ? "AI provider is not configured on the server."
        : "AI generation failed because the configured provider could not complete the request."
    });
  }
});

app.post("/api/analyze", async (req, res) => {
  const { title = "Study kit", difficulty = "Intermediate", materials = [], sourceText = "" } = req.body;
  const source = sourceText.trim();
  try {
    if (!source) throw new Error("No material text was provided");
    const prompt = `Analyze the uploaded class material below and create a detailed study guide for "${title}" at ${difficulty} level.

Rules:
- Use only the uploaded material. Do not invent a generic course outline.
- Identify the actual topics and headings that appear in the material.
- Write complete explanations in the student's own reading-friendly notes.
- Include every important definition, fact, process, relationship, example, list, diagram label, and exam-relevant detail found in the source.
- Preserve technical terms exactly where possible.
- Do not use placeholder headings such as "Core concepts and definitions".
- Each section must be based on a specific topic found in the source.
- Organize the guide as a useful lesson that can be read before practice questions.

Return only valid JSON in this exact shape:
{"overview":"2-4 sentence summary of the uploaded material","sections":[{"heading":"actual topic from the source","content":"detailed paragraph(s) explaining that topic using the source"}],"terms":[{"word":"term from the source","meaning":"clear student-friendly meaning"}]}

Uploaded material:
${source.slice(0, 120000)}`;
    const generated = await generateWithGemini(prompt);
    if (!generated?.overview || !Array.isArray(generated.sections)) throw new Error("Invalid AI response");
    res.json({ provider: "gemini", guide: { title, difficulty, ...generated, sourceCount: materials.length } });
  } catch (error) {
    console.error("AI guide generation failed:", error.message);
    res.status(502).json({ error: "AI generation failed" });
  }
});

app.post("/api/questions", async (req, res) => {
  const count = Math.min(Math.max(Number(req.body.count || 10), 1), 50);
  const { title = "this study kit", difficulty = "Intermediate", type = "MCQ", source = "" } = req.body;
  const prompt = `Generate ${count} unique ${type} questions for a ${difficulty} student about "${title}" from this study summary only:

${source.slice(0, 120000)}

Return valid JSON as {"questions":[{"prompt":string,"options":[4 strings],"answer":number,"explanation":string}]}.
For Theory questions use 0 options and include a modelAnswer and explanation. MCQ answer must be the zero-based index of the correct option. Include varied concepts, applications, comparisons, and details from the summary.`;
  try {
    const generated = await generateWithGemini(prompt);
    if (!Array.isArray(generated.questions) || !generated.questions.length) throw new Error("Invalid AI response");
    res.json({ questions: generated.questions });
  } catch (error) {
    console.error("AI question generation failed:", error.message);
    res.status(502).json({ error: "AI generation failed" });
  }
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Kivo API listening on http://localhost:${PORT}`));
}

export default app;
