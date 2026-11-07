import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, provider: process.env.OPENAI_API_KEY ? "openai" : process.env.GEMINI_API_KEY ? "gemini" : "local-preview" });
});

app.post("/api/analyze", async (req, res) => {
  const { title = "Study kit", difficulty = "Intermediate", materials = [], sourceText = "" } = req.body;
  const prompt = `Create a detailed student study guide for "${title}" at ${difficulty} level, based only on this source material. Include definitions, core concepts, important details, relationships, examples, and exam review. Return valid JSON with overview (string), sections (array of {heading, content}), and terms (array of {word, meaning}). Make the sections detailed.

Source:
${sourceText.slice(0, 120000) || materials.map((item) => item.name).join(", ")}`;
  let generated = null;
  try {
    if (process.env.OPENAI_API_KEY) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", response_format: { type: "json_object" }, messages: [{ role: "user", content: prompt }] })
      });
      if (!response.ok) throw new Error(await response.text());
      generated = JSON.parse((await response.json()).choices[0].message.content);
    } else if (process.env.GEMINI_API_KEY) {
      const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationConfig: { responseMimeType: "application/json" }, contents: [{ parts: [{ text: prompt }] }] })
      });
      if (!response.ok) throw new Error(await response.text());
      generated = JSON.parse((await response.json()).candidates[0].content.parts[0].text);
    }
  } catch (error) {
    console.error("AI guide generation failed:", error.message);
  }
  const guide = generated ? { title, difficulty, ...generated } : {
    title,
    difficulty,
    overview: sourceText
      ? `This detailed guide is organized from the ${materials.length} uploaded source${materials.length === 1 ? "" : "s"}. Read each section carefully, explain the ideas from memory, and apply them to examples in the material.`
      : "Add text-readable source files and configure an AI provider to produce a source-specific summary.",
    sections: [
      { heading: "Core concepts and definitions", content: "Identify each major term, definition, and principle in the source. Explain what the idea means, why it matters, and connect every definition to a concrete example." },
      { heading: "Important details", content: "Organize the supporting facts, processes, distinctions, exceptions, formulas, dates, and relationships. Separate essential facts from examples and explain how they support the central topic." },
      { heading: "Connections and applications", content: "Compare related ideas, describe sequences and cause-and-effect relationships, and use the concepts to solve realistic examples or answer application questions." },
      { heading: "Exam-ready review", content: "Close the source and write a summary from memory. Reconstruct definitions and processes, check your answer against the materials, and repeat difficult sections." }
    ],
    terms: [
      { word: "Recall", meaning: "Retrieving learned information from memory without seeing the source." },
      { word: "Application", meaning: "Using a concept accurately in a new situation or example." }
    ],
    sourceCount: materials.length
  };
  res.json({ provider: process.env.OPENAI_API_KEY ? "openai" : process.env.GEMINI_API_KEY ? "gemini" : "local-preview", guide });
});

app.post("/api/questions", async (req, res) => {
  const count = Math.min(Math.max(Number(req.body.count || 10), 1), 50);
  const { title = "this study kit", difficulty = "Intermediate", type = "MCQ", source = "" } = req.body;
  const prompt = `Generate ${count} unique ${type} questions for a ${difficulty} student from this study summary only:

${source.slice(0, 120000)}

Return valid JSON as {"questions":[{"prompt":string,"options":[4 strings],"answer":number,"explanation":string}]}.
For Theory questions use 0 options and include a modelAnswer and explanation. MCQ answer must be the zero-based index of the correct option. Include varied concepts, applications, comparisons, and details from the summary.`;
  let questions = null;
  try {
    if (process.env.OPENAI_API_KEY) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", response_format: { type: "json_object" }, messages: [{ role: "user", content: prompt }] })
      });
      if (!response.ok) throw new Error(await response.text());
      questions = JSON.parse((await response.json()).choices[0].message.content).questions;
    } else if (process.env.GEMINI_API_KEY) {
      const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationConfig: { responseMimeType: "application/json" }, contents: [{ parts: [{ text: prompt }] }] })
      });
      if (!response.ok) throw new Error(await response.text());
      questions = JSON.parse((await response.json()).candidates[0].content.parts[0].text).questions;
    }
  } catch (error) {
    console.error("AI question generation failed:", error.message);
  }
  if (!Array.isArray(questions) || !questions.length) {
    questions = Array.from({ length: count }, (_, index) => ({
      id: crypto.randomUUID(),
      prompt: `${type === "Theory" ? "Explain" : "Which answer best describes"} key concept ${index + 1} from the "${title}" study summary at ${difficulty} level?`,
      options: type === "Theory" ? [] : ["A concept explained accurately with supporting evidence", "An unrelated detail", "A claim contradicted by the summary", "A definition without context"],
      answer: type === "Theory" ? null : 0,
      modelAnswer: "State the concept, explain its key details, and support the answer with an accurate example from the summary.",
      explanation: "A strong answer connects the concept, supporting detail, and application."
    }));
  }
  res.json({ questions });
});

app.listen(PORT, () => {
  console.log(`Kivo API listening on http://localhost:${PORT}`);
});
