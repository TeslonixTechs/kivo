import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 4000;
app.use(cors({ origin: true }));
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, provider: process.env.GEMINI_API_KEY ? "gemini" : "not-configured" });
});

async function generateWithGemini(prompt) {
  if (!process.env.GEMINI_API_KEY) throw new Error("AI provider is not configured");
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      generationConfig: { responseMimeType: "application/json" },
      contents: [{ parts: [{ text: prompt }] }]
    })
  });
  if (!response.ok) throw new Error(`Gemini request failed (${response.status})`);
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("");
  return JSON.parse(text);
}

app.post("/api/analyze", async (req, res) => {
  const { title = "Study kit", difficulty = "Intermediate", materials = [], sourceText = "" } = req.body;
  const prompt = `Create a detailed student study guide for "${title}" at ${difficulty} level, based only on this source material. Include definitions, core concepts, important details, relationships, examples, and exam review. Return valid JSON with overview (string), sections (array of {heading, content}), and terms (array of {word, meaning}). Make the sections detailed.

Source:
${sourceText.slice(0, 120000) || materials.map((item) => item.name).join(", ")}`;
  try {
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
