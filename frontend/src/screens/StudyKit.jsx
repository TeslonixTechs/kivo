import { useEffect, useRef, useState } from "react";
import { ArrowLeft, BookOpen, Check, CircleHelp, Download, FileText, FolderOpen, RotateCcw, Sparkles, Trash2, UploadCloud, Volume2, VolumeX } from "lucide-react";
import * as pdfjs from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import mammoth from "mammoth/mammoth.browser";
import JSZip from "jszip";
import AppShell from "../components/AppShell";
import LoadingState from "../components/LoadingState";
import StudyNotes from "../components/StudyNotes";
import { apiUrl } from "../lib/api";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

const extractMaterialText = async (material) => {
  if (!material.blob) return "";
  const name = material.name.toLowerCase();
  if (/\.pdf$/i.test(name)) {
    const pdf = await pdfjs.getDocument({ data: await material.blob.arrayBuffer() }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str || "").join(" "));
    }
    return `${material.name}\n${pages.join("\n\n")}`;
  }
  if (/\.docx$/i.test(name)) {
    const result = await mammoth.extractRawText({ arrayBuffer: await material.blob.arrayBuffer() });
    return `${material.name}\n${result.value}`;
  }
  if (/\.pptx$/i.test(name)) {
    const zip = await JSZip.loadAsync(await material.blob.arrayBuffer());
    const slideFiles = Object.keys(zip.files).filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path)).sort((a, b) => Number(a.match(/(\d+)/)?.[1]) - Number(b.match(/(\d+)/)?.[1]));
    const slides = [];
    for (const slideFile of slideFiles) {
      const xml = await zip.file(slideFile).async("text");
      const text = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((match) => match[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")).join(" ");
      slides.push(text);
    }
    return `${material.name}\n${slides.map((slide, index) => `Slide ${index + 1}: ${slide}`).join("\n\n")}`;
  }
  if (/\.txt$|\.md$|\.csv$|\.json$|\.xml$/i.test(name)) return `${material.name}\n${await material.blob.text()}`;
  return "";
};

const requestQuestions = async ({ kit, guide, type = "MCQ", difficulty = "Intermediate", count = 10 }) => {
  const response = await fetch(apiUrl("/api/questions"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: kit.title,
      difficulty,
      type,
      count,
      source: guide?.overview ? [guide.overview, ...(guide.sections || []).map((section) => `${section.heading}: ${section.content}`)].join("\n\n") : ""
    })
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Question generation failed.");
  }
  return response.json();
};

const getGuideTerms = (guide) => {
  const terms = [...(guide?.terms || []), ...(guide?.sections || []).flatMap((section) => section.keyTerms || [])]
    .map((item) => ({
      term: String(item.term || item.word || "").trim(),
      meaning: String(item.meaning || "").trim(),
    }))
    .filter((item) => item.term && item.meaning);
  return terms.filter((item, index, list) => (
    list.findIndex((entry) => entry.term.toLocaleLowerCase() === item.term.toLocaleLowerCase()) === index
  ));
};

export default function StudyKit({ kit, onNavigate, onUpdate }) {
  const [tab, setTab] = useState("guide");
  const [generating, setGenerating] = useState(false);
  const [guideError, setGuideError] = useState("");
  const [copied, setCopied] = useState(false);
  const [editingGuide, setEditingGuide] = useState(false);
  const [guideDraft, setGuideDraft] = useState(null);
  const [guideSaveError, setGuideSaveError] = useState("");
  const [readingAloud, setReadingAloud] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const input = useRef(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pastedText, setPastedText] = useState("");
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  const addFiles = (files) => {
    const materials = [...files].map((file) => ({ id: crypto.randomUUID(), name: file.name, size: file.size, type: file.type, blob: file, createdAt: new Date().toISOString() }));
    onUpdate({ ...kit, materials: [...(kit.materials || []), ...materials] });
  };
  const generate = async () => {
    setGenerating(true);
    setGuideError("");
    try {
      const sourceText = await Promise.all((kit.materials || []).map(extractMaterialText));
      const response = await fetch(apiUrl("/api/study-guide"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: kit.title, difficulty: kit.difficulty, materials: kit.materials || [], sourceText: sourceText.filter(Boolean).join("\n\n") })
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Study guide generation failed.");
      }
      const result = await response.json();
      await onUpdate({ ...kit, progress: 25, guide: result.guide });
      setGenerating(false);
    } catch (error) {
      console.error("Study guide generation failed:", error);
      setGuideError("We couldn't generate your study notes. Please try again.");
      setGenerating(false);
    }
  };
  const removeMaterial = async (material) => {
    if (!window.confirm(`Delete "${material.name}" from this study kit?`)) return;
    await onUpdate({ ...kit, guide: null, materials: kit.materials.filter((item) => item.id !== material.id) });
  };
  const addPastedText = async () => {
    if (!pastedText.trim()) return;
    const blob = new Blob([pastedText.trim()], { type: "text/plain" });
    const material = { id: crypto.randomUUID(), name: `Pasted notes ${new Date().toLocaleDateString()}.txt`, size: blob.size, type: "text/plain", blob, createdAt: new Date().toISOString() };
    await onUpdate({ ...kit, guide: null, materials: [...(kit.materials || []), material] });
    setPastedText("");
    setPasteOpen(false);
  };
  const copyNotes = async () => {
    const guide = kit.guide;
    const notes = [
      guide.title,
      guide.overview,
      ...(guide.sections || []).flatMap((section) => [
        section.heading,
        section.content,
        ...(section.points || []),
        ...(section.keyTerms || []).map((term) => `${term.term || term.word}: ${term.meaning}`)
      ]),
      ...(guide.terms || []).map((term) => `${term.term || term.word}: ${term.meaning}`),
      ...(guide.quickRevision || [])
    ].filter(Boolean).join("\n\n");
    await navigator.clipboard.writeText(notes);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  const toggleReadAloud = () => {
    if (!window.speechSynthesis) return;
    if (readingAloud) {
      window.speechSynthesis.cancel();
      setReadingAloud(false);
      return;
    }
    const guide = kit.guide;
    const content = [
      guide.title,
      guide.overview,
      ...(guide.sections || []).flatMap((section) => [
        section.heading, section.content, ...(section.points || []),
        ...(section.keyTerms || []).map((term) => `${term.term || term.word}: ${term.meaning}`),
      ]),
      ...(guide.terms || []).map((term) => `${term.term || term.word}: ${term.meaning}`),
      ...(guide.quickRevision || []),
    ].filter(Boolean).join(". ");
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.onend = () => setReadingAloud(false);
    utterance.onerror = () => setReadingAloud(false);
    setReadingAloud(true);
    window.speechSynthesis.speak(utterance);
  };
  const startGuideEdit = () => {
    setGuideDraft(structuredClone(kit.guide));
    setGuideSaveError("");
    setEditingGuide(true);
  };
  const saveGuideEdit = async () => {
    try {
      await onUpdate({ ...kit, guide: guideDraft });
      setEditingGuide(false);
      setGuideDraft(null);
      setGuideSaveError("");
    } catch (error) {
      console.error("Study guide edits could not be saved:", error);
      setGuideSaveError("Your edits could not be saved. Please try again.");
    }
  };
  const downloadGuide = async () => {
    const guide = kit.guide;
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ format: "a4", unit: "pt" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 52;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;
    const plainText = (value) => String(value ?? "").replace(/\*\*(.+?)\*\*/g, "$1");
    const ensureSpace = (height) => {
      if (y + height > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
    };
    const writeText = (value, { size = 11, bold = false, color = [55, 65, 81], indent = 0, gap = 8 } = {}) => {
      const text = plainText(value);
      if (!text) return;
      pdf.setFont("helvetica", bold ? "bold" : "normal");
      pdf.setFontSize(size);
      pdf.setTextColor(...color);
      const lines = pdf.splitTextToSize(text, contentWidth - indent);
      const lineHeight = size * 1.45;
      for (const line of lines) {
        ensureSpace(lineHeight);
        pdf.text(line, margin + indent, y);
        y += lineHeight;
      }
      y += gap;
    };
    writeText(guide.title || kit.title, { size: 25, bold: true, color: [35, 29, 65], gap: 8 });
    writeText(`${guide.difficulty || kit.difficulty} study guide`, { size: 10, bold: true, color: [124, 58, 237], gap: 18 });
    if (guide.overview) writeText(guide.overview, { size: 12, color: [80, 91, 115], gap: 18 });
    for (const section of guide.sections || []) {
      writeText(section.heading, { size: 17, bold: true, color: [35, 29, 65], gap: 7 });
      if (section.content) writeText(section.content, { size: 11 });
      for (const point of section.points || []) {
        writeText(`- ${point}`, { size: 11, indent: 10, gap: 4 });
      }
      for (const term of section.keyTerms || []) {
        writeText(`${term.term || term.word}: ${term.meaning}`, { size: 10, indent: 10, gap: 4 });
      }
      y += 10;
    }
    if (guide.terms?.length) {
      writeText("Key terms", { size: 17, bold: true, color: [35, 29, 65], gap: 7 });
      for (const term of guide.terms) {
        writeText(`${term.term || term.word}: ${term.meaning}`, { size: 10, indent: 10, gap: 4 });
      }
    }
    if (guide.quickRevision?.length) {
      writeText("Quick revision", { size: 17, bold: true, color: [35, 29, 65], gap: 7 });
      for (const point of guide.quickRevision) {
        writeText(`- ${point}`, { size: 11, indent: 10, gap: 4 });
      }
    }
    const pageCount = pdf.internal.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      pdf.setPage(page);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(140, 145, 160);
      pdf.text(`${page} / ${pageCount}`, pageWidth - margin, pageHeight - 24, { align: "right" });
    }
    const filename = String(guide.title || kit.title || "study-guide")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "study-guide";
    pdf.save(`${filename}.pdf`);
  };

  const tabs = [["guide", BookOpen, "Study guide"], ["materials", FolderOpen, "Materials"], ["flashcards", RotateCcw, "Flashcards"], ["smart", Sparkles, "Smart study"], ["test", CircleHelp, "Test"]];
  const hasMaterials = (kit.materials || []).length > 0;
  const activityScore = Math.min(100, (kit.progress || 0) + (kit.guide ? 25 : 0) + (hasMaterials ? 15 : 0));
  return <AppShell page="kits" onNavigate={onNavigate}><div className="study-page"><button className="back-link kit-back" onClick={() => onNavigate("dashboard")}><ArrowLeft size={16} /> All kits</button><header className="kit-heading"><div><p className="eyebrow">{kit.difficulty} study kit</p><h1>{kit.title}</h1></div><div className="kit-progress" aria-label={`${activityScore}% activity, performance, and consistency score`}><span>{activityScore}% study progress</span><div><i style={{ width: `${activityScore}%` }} /></div></div></header><nav className="study-tabs">{tabs.map(([id, Icon, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><Icon size={18} /><span>{label}</span></button>)}</nav>
    {tab === "materials" && <section className="tab-panel"><div className="section-title"><div><p className="eyebrow">SOURCE LIBRARY</p><h2>Materials</h2></div><span>{kit.materials?.length || 0} files</span></div><div className="upload-actions"><button className="upload-zone" onClick={() => input.current.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files); }}><input ref={input} type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.csv,.rtf" onChange={(event) => addFiles(event.target.files)} /><UploadCloud /><strong>Upload study materials</strong><span>PDF, Word, PowerPoint, text, Markdown, CSV, and RTF</span></button><button className="paste-source" onClick={() => setPasteOpen(true)}><FileText /><strong>Paste text</strong><span>Add copied notes directly</span></button></div>{pasteOpen && <div className="paste-panel"><label><span>Paste class notes or copied text</span><textarea autoFocus value={pastedText} onChange={(event) => setPastedText(event.target.value)} placeholder="Paste your study notes here..." /></label><div><button className="secondary-button" onClick={() => setPasteOpen(false)}>Cancel</button><button className="primary-button" disabled={!pastedText.trim()} onClick={addPastedText}>Add notes</button></div></div>}<div className="material-list">{kit.materials?.map((file) => <div key={file.id}><div className="file-icon"><FileText size={19} /></div><span><strong>{file.name}</strong><small>{Math.max(1, Math.round(file.size / 1024))} KB</small></span><button className="delete-material" aria-label={`Delete ${file.name}`} onClick={() => removeMaterial(file)}><Trash2 size={17} /></button></div>)}</div></section>}
    {tab === "guide" && (
      <section className="tab-panel guide-panel">
        {!hasMaterials ? (
          <div className="generate-state guide-empty-card">
            <div><FolderOpen /></div>
            <h2>Upload materials first</h2>
            <button className="primary-button" onClick={() => setTab("materials")}>Go to Materials</button>
          </div>
        ) : generating ? (
          <LoadingState label="Preparing your notes..." />
        ) : kit.guide ? (
          <div>
            <div className="guide-actions">
              {editingGuide ? (
                <>
                  <button className="secondary-button" onClick={() => { setEditingGuide(false); setGuideDraft(null); setGuideSaveError(""); }}>Cancel editing</button>
                  <button className="primary-button" onClick={saveGuideEdit}>Save changes</button>
                </>
              ) : (
                <>
                  <button className="secondary-button" onClick={startGuideEdit}>Edit guide</button>
                  <button className="secondary-button" onClick={toggleReadAloud} disabled={!window.speechSynthesis}>{readingAloud ? <VolumeX size={16} /> : <Volume2 size={16} />}{readingAloud ? "Stop reading" : "Read aloud"}</button>
                  <button className="secondary-button" disabled={generating || !isOnline} onClick={generate}>Regenerate</button>
                  <button className="primary-button" onClick={copyNotes}>{copied ? "Copied!" : "Copy notes"}</button>
                  <button className="secondary-button guide-download" onClick={downloadGuide}><Download size={16} /> Download PDF</button>
                </>
              )}
            </div>
            {guideSaveError && <p className="guide-error" role="alert">{guideSaveError}</p>}
            {!isOnline && !editingGuide && <p className="offline-feature-note">Your saved guide and flashcards are available offline. Generation needs internet.</p>}
            {editingGuide
              ? <GuideEditor guide={guideDraft} onChange={setGuideDraft} />
              : <StudyNotes guide={kit.guide} />}
          </div>
        ) : (
          <div className="generate-state guide-empty-card">
            <div><Sparkles /></div>
            {guideError && <p className="guide-error" role="alert">{guideError}</p>}
            <p>Generate a study guide from your uploaded materials</p>
            <button className="primary-button" disabled={generating || !isOnline} onClick={generate}>
              {!isOnline ? "Connect to generate" : guideError ? "Retry" : "Generate study guide"}
            </button>
            {!isOnline && <p className="offline-feature-note">Guide generation needs an internet connection.</p>}
          </div>
        )}
      </section>
    )}
    {tab === "flashcards" && <Flashcards kit={kit} onUpdate={onUpdate} />}
    {tab === "smart" && <SmartPractice kit={kit} onUpdate={onUpdate} isOnline={isOnline} />}
    {tab === "test" && <TestView kit={kit} isOnline={isOnline} />}
  </div></AppShell>;
}

function GuideEditor({ guide, onChange }) {
  const updateSection = (sectionIndex, updates) => {
    onChange({
      ...guide,
      sections: guide.sections.map((section, index) => index === sectionIndex
        ? { ...section, ...updates }
        : section),
    });
  };
  const updateTerms = (terms, update) => terms.map((term, index) => index === update.index
    ? { ...term, [update.field]: update.value }
    : term);
  const addSection = () => onChange({
    ...guide,
    sections: [...(guide.sections || []), { heading: "New section", content: "", points: [], keyTerms: [] }],
  });
  const removeSection = (sectionIndex) => onChange({
    ...guide,
    sections: guide.sections.filter((_, index) => index !== sectionIndex),
  });

  return (
    <div className="guide-editor">
      <label>
        Guide title
        <input value={guide.title || ""} onChange={(event) => onChange({ ...guide, title: event.target.value })} />
      </label>
      <label>
        Summary
        <textarea value={guide.overview || ""} onChange={(event) => onChange({ ...guide, overview: event.target.value })} />
      </label>
      {(guide.sections || []).map((section, sectionIndex) => (
        <section className="guide-editor-section" key={sectionIndex}>
          <div className="guide-editor-heading">
            <label>
              Section heading
              <input value={section.heading || ""} onChange={(event) => updateSection(sectionIndex, { heading: event.target.value })} />
            </label>
            <button type="button" className="delete-material" aria-label={`Remove section ${section.heading || sectionIndex + 1}`} onClick={() => removeSection(sectionIndex)}><Trash2 size={16} /></button>
          </div>
          <label>
            Explanation
            <textarea value={section.content || ""} onChange={(event) => updateSection(sectionIndex, { content: event.target.value })} />
          </label>
          <label>
            Key points <span className="guide-editor-hint">One point per line</span>
            <textarea value={(section.points || []).join("\n")} onChange={(event) => updateSection(sectionIndex, { points: event.target.value.split("\n").filter((point) => point.trim()) })} />
          </label>
          <div className="guide-editor-terms">
            <span>Defined terms</span>
            {(section.keyTerms || []).map((term, termIndex) => (
              <div className="guide-editor-term" key={termIndex}>
                <input aria-label="Term" value={term.term || term.word || ""} onChange={(event) => updateSection(sectionIndex, {
                  keyTerms: updateTerms(section.keyTerms || [], { index: termIndex, field: term.term === undefined ? "word" : "term", value: event.target.value }),
                })} />
                <textarea aria-label={`Definition of ${term.term || term.word}`} value={term.meaning || ""} onChange={(event) => updateSection(sectionIndex, {
                  keyTerms: updateTerms(section.keyTerms || [], { index: termIndex, field: "meaning", value: event.target.value }),
                })} />
                <button type="button" className="delete-material" aria-label="Remove term" onClick={() => updateSection(sectionIndex, { keyTerms: (section.keyTerms || []).filter((_, index) => index !== termIndex) })}><Trash2 size={15} /></button>
              </div>
            ))}
            <button type="button" className="secondary-button" onClick={() => updateSection(sectionIndex, {
              keyTerms: [...(section.keyTerms || []), { term: "", meaning: "" }],
            })}>Add defined term</button>
          </div>
        </section>
      ))}
      <div className="guide-editor-terms">
        <span>Additional defined terms</span>
        {(guide.terms || []).map((term, termIndex) => (
          <div className="guide-editor-term" key={termIndex}>
            <input aria-label="Term" value={term.term || term.word || ""} onChange={(event) => onChange({
              ...guide,
              terms: updateTerms(guide.terms || [], { index: termIndex, field: term.term === undefined ? "word" : "term", value: event.target.value }),
            })} />
            <textarea aria-label={`Definition of ${term.term || term.word}`} value={term.meaning || ""} onChange={(event) => onChange({
              ...guide,
              terms: updateTerms(guide.terms || [], { index: termIndex, field: "meaning", value: event.target.value }),
            })} />
            <button type="button" className="delete-material" aria-label="Remove term" onClick={() => onChange({
              ...guide,
              terms: (guide.terms || []).filter((_, index) => index !== termIndex),
            })}><Trash2 size={15} /></button>
          </div>
        ))}
        <button type="button" className="secondary-button" onClick={() => onChange({
          ...guide,
          terms: [...(guide.terms || []), { term: "", meaning: "" }],
        })}>Add defined term</button>
      </div>
      <button type="button" className="secondary-button" onClick={addSection}>Add section</button>
      <label>
        Quick revision <span className="guide-editor-hint">One item per line</span>
        <textarea value={(guide.quickRevision || []).join("\n")} onChange={(event) => onChange({ ...guide, quickRevision: event.target.value.split("\n").filter((point) => point.trim()) })} />
      </label>
    </div>
  );
}

function Flashcards({ kit, onUpdate }) {
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [transferMessage, setTransferMessage] = useState("");
  const importInput = useRef(null);
  const [studyAll, setStudyAll] = useState(false);
  const [reviewedNow, setReviewedNow] = useState([]);
  const terms = getGuideTerms(kit.guide);
  const progress = kit.flashcardProgress || {};
  const now = Date.now();
  const dueCards = terms.filter(({ term }) => {
    const dueAt = progress[term.toLocaleLowerCase()]?.dueAt;
    return !dueAt || new Date(dueAt).getTime() <= now;
  });
  const nextDue = terms
    .map(({ term }) => progress[term.toLocaleLowerCase()]?.dueAt)
    .filter((dueAt) => dueAt && new Date(dueAt).getTime() > now)
    .sort((a, b) => new Date(a) - new Date(b))[0];
  const knownCount = terms.filter(({ term }) => (progress[term.toLocaleLowerCase()]?.repetitions || 0) > 0).length;
  const reviewedCount = terms.filter(({ term }) => progress[term.toLocaleLowerCase()]?.lastReviewedAt).length;
  const cardQueue = studyAll
    ? terms.filter(({ term }) => !reviewedNow.includes(term.toLocaleLowerCase()))
    : dueCards;
  const card = cardQueue[0];
  const formatDueDate = (date) => new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
  const exportDeck = () => {
    const data = JSON.stringify({ format: "kivo-flashcards", version: 1, title: kit.title, terms }, null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${kit.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "study-kit"}-flashcards.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setTransferMessage("Flashcards exported.");
  };
  const importDeck = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setTransferMessage("");
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error("Choose a flashcard JSON file smaller than 2 MB.");
      const data = JSON.parse(await file.text());
      if (data.format !== "kivo-flashcards" || data.version !== 1 || !Array.isArray(data.terms) || data.terms.length > 500) {
        throw new Error("This flashcard file is invalid or uses an unsupported format.");
      }
      const imported = data.terms.map((item) => ({
        term: String(item?.term || "").trim(),
        meaning: String(item?.meaning || "").trim(),
      }));
      if (imported.some((item) => !item.term || !item.meaning || item.term.length > 300 || item.meaning.length > 3000)) {
        throw new Error("Every card needs a term (up to 300 characters) and definition (up to 3,000 characters).");
      }
      const existing = getGuideTerms(kit.guide);
      const merged = [...existing];
      imported.forEach((item) => {
        const index = merged.findIndex((entry) => entry.term.toLocaleLowerCase() === item.term.toLocaleLowerCase());
        if (index < 0) merged.push(item);
        else merged[index] = item;
      });
      if (merged.length > 1000) throw new Error("This deck would exceed the 1,000-card limit.");
      await onUpdate({ ...kit, guide: { ...kit.guide, terms: merged } });
      setTransferMessage(`Imported ${imported.length} card${imported.length === 1 ? "" : "s"}. Existing terms were updated when names matched.`);
    } catch (error) {
      console.error("Flashcard import failed:", error);
      setTransferMessage(error.message || "The flashcard file could not be imported.");
    }
  };
  const transferControls = (
    <div className="flashcard-transfer">
      <button type="button" className="secondary-button" onClick={exportDeck} disabled={!terms.length}><Download size={16} /> Export JSON</button>
      <button type="button" className="secondary-button" onClick={() => importInput.current?.click()}><UploadCloud size={16} /> Import JSON</button>
      <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={importDeck} />
      {transferMessage && <span role="status">{transferMessage}</span>}
    </div>
  );

  const rateCard = async (knewIt) => {
    if (!card || saving) return;
    setSaving(true);
    setSaveError("");
    const key = card.term.toLocaleLowerCase();
    const previous = progress[key] || { repetitions: 0, intervalDays: 0 };
    const repetitions = knewIt ? previous.repetitions + 1 : 0;
    const intervalDays = knewIt
      ? previous.repetitions === 0
        ? 1
        : previous.repetitions === 1
          ? 3
          : Math.max(1, Math.round(previous.intervalDays * 2.5))
      : 0;
    const dueAt = knewIt
      ? new Date(now + intervalDays * 24 * 60 * 60 * 1000)
      : new Date(now + 10 * 60 * 1000);
    try {
      await onUpdate({
        ...kit,
        flashcardProgress: {
          ...progress,
          [key]: {
            repetitions,
            intervalDays,
            dueAt: dueAt.toISOString(),
            lastReviewedAt: new Date(now).toISOString(),
            lastRating: knewIt ? "known" : "review",
          },
        },
      });
      if (studyAll) setReviewedNow((current) => [...current, key]);
      setRevealed(false);
    } catch (error) {
      console.error("Flashcard progress could not be saved:", error);
      setSaveError("Your review could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!kit.guide) {
    return <section className="tab-panel generate-state"><div><Sparkles /></div><p className="eyebrow">FLASHCARDS</p><h2>Generate your study guide first</h2><p>Flashcards are created from the defined terms in your study guide.</p></section>;
  }
  if (!terms.length) {
    return <section className="tab-panel flashcards-panel"><div className="generate-state"><div><BookOpen /></div><p className="eyebrow">FLASHCARDS</p><h2>No key terms yet</h2><p>Import a deck or add defined terms to your study guide.</p></div>{transferControls}</section>;
  }
  if (!card) {
    return (
      <section className="tab-panel flashcards-panel">
        {transferControls}
        <div className="flashcards-summary">
          <strong>{knownCount} / {terms.length} known</strong>
          <span>{reviewedCount} reviewed · {dueCards.length} due</span>
        </div>
        <div className="flashcard-empty">
          <Check size={24} />
          <h2>{studyAll ? "Deck complete!" : "Great work!"}</h2>
          <p>{studyAll ? "You reviewed every card in this deck." : "There are no cards due right now."}</p>
          {!studyAll && nextDue && <span>Next review: {formatDueDate(nextDue)}</span>}
          <button type="button" className="primary-button" onClick={() => {
            setStudyAll(true);
            setReviewedNow([]);
            setRevealed(false);
          }}>{studyAll ? "Review all cards again" : "Review cards now"}</button>
        </div>
      </section>
    );
  }
  const cardProgress = progress[card.term.toLocaleLowerCase()] || {};
  return (
    <section className="tab-panel flashcards-panel">
      <div className="flashcards-summary">
        <strong>{dueCards.length} due</strong>
        <span>{knownCount} / {terms.length} known · {reviewedCount} reviewed</span>
      </div>
      {!studyAll && <button type="button" className="flashcards-review-all" onClick={() => {
        setStudyAll(true);
        setReviewedNow([]);
        setRevealed(false);
      }}>Review all cards now</button>}
      {studyAll && <p className="flashcards-mode">Reviewing all cards · {reviewedNow.length + 1} of {terms.length}</p>}
      <button
        type="button"
        className={`flashcard${revealed ? " is-revealed" : ""}`}
        onClick={() => setRevealed((value) => !value)}
        aria-label={revealed ? `Definition: ${card.meaning}. Click to show term.` : `Show definition for ${card.term}`}
      >
        <span className="eyebrow">{revealed ? "DEFINITION" : "TERM"}</span>
        <strong>{revealed ? card.meaning : card.term}</strong>
        <span className="flashcard-hint">{revealed ? "Tap to show the term" : "Tap to reveal the definition"}</span>
      </button>
      <p className="flashcard-review-count">
        {cardProgress.repetitions ? `Known through ${cardProgress.repetitions} review${cardProgress.repetitions === 1 ? "" : "s"}` : "New card"}
      </p>
      {revealed && (
        <div className="flashcard-actions">
          <button type="button" className="secondary-button" disabled={saving} onClick={() => rateCard(false)}>
            <RotateCcw size={16} /> Review it
          </button>
          <button type="button" className="primary-button" disabled={saving} onClick={() => rateCard(true)}>
            <Check size={16} /> Know it
          </button>
        </div>
      )}
      {saveError && <p className="flashcard-error" role="alert">{saveError}</p>}
    </section>
  );
}

function SmartPractice({ kit, onUpdate, isOnline }) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [activityError, setActivityError] = useState("");
  const activity = kit.studyActivity || [];
  const sessionActivity = activity.filter((item) => item.sessionId === sessionId);
  const correctCount = sessionActivity.filter((item) => item.correct).length;
  const answeredCount = sessionActivity.length;
  const accuracy = answeredCount ? Math.round((correctCount / answeredCount) * 100) : 100;
  const loadQuestions = async () => {
    if (!isOnline) return;
    setLoading(true);
    setActivityError("");
    try {
      const result = await requestQuestions({ kit, guide: kit.guide, type: "MCQ", difficulty: kit.difficulty, count: 20 });
      setQuestions(result.questions || []);
      setQuestionIndex(0);
      setAnswer(null);
      setSessionId(crypto.randomUUID());
    } catch (error) {
      console.error("Smart study generation failed:", error);
      window.alert("AI generation failed");
    } finally {
      setLoading(false);
    }
  };
  if (!kit.guide) return <section className="tab-panel generate-state"><div><Sparkles /></div><p className="eyebrow">SMART STUDY</p><h2>Generate your study guide first</h2><p>Smart Study creates questions from the summary that is generated from your uploaded notes.</p><StudyActivitySummary activity={activity} /></section>;
  if (!questions.length) return <section className="tab-panel practice">
    <StudyActivitySummary activity={activity} />
    {loading ? <LoadingState label="Generating smart study questions" /> : <div className="practice-card practice-launch"><Sparkles /><h2>Practice from your study guide</h2><p>Questions are generated from the key concepts in your uploaded notes.</p><button className="primary-button" disabled={!isOnline} onClick={loadQuestions}>{isOnline ? "Start smart study" : "Connect to generate questions"}</button>{!isOnline && <p className="offline-feature-note">Your saved guide and flashcards are available offline. Smart Study questions need internet.</p>}</div>}
  </section>;
  const question = questions[questionIndex % questions.length];
  const chooseAnswer = async (index) => {
    if (answer !== null) return;
    setAnswer(index);
    setActivityError("");
    const record = {
      id: crypto.randomUUID(),
      sessionId,
      question: question.prompt,
      topic: question.topic || "General review",
      correct: index === question.answer,
      answeredAt: new Date().toISOString(),
    };
    try {
      await onUpdate({
        ...kit,
        studyActivity: [...activity, record].slice(-500),
      });
    } catch (error) {
      console.error("Study activity could not be saved:", error);
      setActivityError("This answer could not be saved to your study history.");
    }
  };
  const nextQuestion = () => {
    setQuestionIndex((index) => index + 1);
    setAnswer(null);
  };
  return (
    <section className="tab-panel practice">
      <div className="accuracy"><span>Session accuracy</span><strong>{accuracy}%</strong></div>
      {activityError && <p className="flashcard-error" role="alert">{activityError}</p>}
      <div className="practice-card">
        <span className="eyebrow">QUESTION {questionIndex + 1}</span>
        <h2>{question.prompt}</h2>
        {answer !== null && (
          <div
            className={`answer-feedback ${answer === question.answer ? "correct" : "wrong"}`}
            role="status"
            aria-live="polite"
          >
            <strong>{answer === question.answer ? "Exactly right!" : "Not quite."}</strong>{" "}
            {question.explanation}
          </div>
        )}
        <div>
          {question.options.map((option, index) => (
            <button
              key={option}
              className={[
                answer !== null && index === question.answer ? "correct" : "",
                answer === index && index !== question.answer ? "wrong" : "",
                answer === index && index === question.answer ? "selected-correct" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => chooseAnswer(index)}
            >
              <i>{String.fromCharCode(65 + index)}</i>{option}
            </button>
          ))}
        </div>
        <div className="practice-actions">
          <button className="skip-button" onClick={nextQuestion}>Skip question</button>
          <button className="primary-button" disabled={answer === null} onClick={nextQuestion}>Next question <span aria-hidden="true">→</span></button>
        </div>
      </div>
      <StudyActivitySummary activity={activity} />
    </section>
  );
}

function StudyActivitySummary({ activity }) {
  const sessions = Object.values(activity.reduce((groups, record) => {
    if (!record.sessionId) return groups;
    const group = groups[record.sessionId] || {
      id: record.sessionId,
      records: [],
      latestAt: record.answeredAt,
    };
    group.records.push(record);
    if (new Date(record.answeredAt) > new Date(group.latestAt)) group.latestAt = record.answeredAt;
    groups[record.sessionId] = group;
    return groups;
  }, {})).sort((a, b) => new Date(b.latestAt) - new Date(a.latestAt));
  const topicStats = activity.reduce((topics, record) => {
    const topic = record.topic || "General review";
    const item = topics[topic] || { attempts: 0, incorrect: 0 };
    item.attempts += 1;
    if (!record.correct) item.incorrect += 1;
    topics[topic] = item;
    return topics;
  }, {});
  const topicsToReview = Object.entries(topicStats)
    .filter(([, stats]) => stats.incorrect > 0)
    .sort((a, b) => b[1].incorrect - a[1].incorrect || b[1].attempts - a[1].attempts)
    .slice(0, 4);
  const totalCorrect = activity.filter((record) => record.correct).length;
  const overallAccuracy = activity.length ? Math.round((totalCorrect / activity.length) * 100) : null;
  const dateLabel = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));

  return (
    <section className="study-activity">
      <div className="study-activity-heading">
        <div><p className="eyebrow">YOUR PROGRESS</p><h3>Study activity</h3></div>
        {overallAccuracy !== null && <span>{overallAccuracy}% overall accuracy</span>}
      </div>
      {!activity.length ? (
        <p className="study-activity-empty">Answer Smart Study questions to build your progress history.</p>
      ) : (
        <div className="study-activity-grid">
          <div>
            <h4>Topics to revisit</h4>
            {topicsToReview.length
              ? <ul className="weak-topics">{topicsToReview.map(([topic, stats]) => <li key={topic}><span>{topic}</span><strong>{stats.incorrect} missed</strong></li>)}</ul>
              : <p className="study-activity-empty">No missed topics yet. Keep it up!</p>}
          </div>
          <div>
            <h4>Recent sessions</h4>
            <ul className="study-session-list">
              {sessions.slice(0, 5).map((session) => {
                const correct = session.records.filter((record) => record.correct).length;
                const score = Math.round((correct / session.records.length) * 100);
                return <li key={session.id}><span>{dateLabel(session.latestAt)} · {session.records.length} questions</span><strong>{score}%</strong></li>;
              })}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

function TestView({ kit, isOnline }) {
  const [started, setStarted] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [config, setConfig] = useState({ type: "MCQ", difficulty: "Intermediate", questions: 10, timer: 20 });
  const [testQuestions, setTestQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const options = testQuestions[questionIndex]?.options || [];
  const beginTest = async () => {
    if (!isOnline) return;
    setLoading(true);
    try {
      const result = await requestQuestions({ kit, guide: kit.guide, type: config.type, difficulty: config.difficulty, count: Number(config.questions) });
      setTestQuestions(result.questions || []);
      setStarted(true);
      setQuestionIndex(0);
      setSelected(null);
      setAnswers([]);
    } catch (error) {
      console.error("Practice test generation failed:", error);
      window.alert("AI generation failed");
    } finally {
      setLoading(false);
    }
  };
  const next = () => {
    setAnswers((current) => [...current, selected]);
    setSelected(null);
    setQuestionIndex((index) => index + 1);
  };
  if (started && questionIndex >= Number(config.questions)) return <section className="tab-panel test-started"><div className="test-result"><p className="eyebrow">TEST COMPLETE</p><h2>Good work!</h2><p>You completed {config.questions} questions.</p><button className="primary-button" onClick={() => { setStarted(false); setQuestionIndex(0); setAnswers([]); }}>Create another test</button></div></section>;
  if (!kit.guide) return <section className="tab-panel generate-state"><div><Sparkles /></div><p className="eyebrow">TEST</p><h2>Generate your study guide first</h2><p>Tests are created from the summary of your uploaded class notes.</p></section>;
  return started ? <section className="tab-panel test-started">
    <div className="test-run-header"><h2>{kit.title} · {config.type} test</h2><span>{config.timer}:00</span></div>
    <div className="test-progress"><i style={{ width: `${((questionIndex + 1) / Number(config.questions)) * 100}%` }} /></div>
    <div className="test-question">
      <span>QUESTION {questionIndex + 1} OF {config.questions}</span>
      <h3>{testQuestions[questionIndex]?.prompt || "Which answer demonstrates the strongest understanding of the main concept?"}</h3>
      {config.type === "MCQ" ? <div className="test-answer-options">{options.map((answer, index) => {
        const correctAnswer = testQuestions[questionIndex]?.answer ?? 0;
        const state = selected === null ? "" : index === correctAnswer ? "correct" : selected === index ? "wrong" : "";
        return <button type="button" key={answer} className={state} onClick={() => selected === null && setSelected(index)}><i>{String.fromCharCode(65 + index)}</i>{answer}</button>;
      })}</div> : <textarea placeholder="Write your answer..." value={typeof selected === "string" ? selected : ""} onChange={(event) => setSelected(event.target.value)} />}
      <div className="test-actions"><button className="skip-button" onClick={next}>Skip question</button><button className="primary-button" disabled={selected === null || selected === ""} onClick={next}>{questionIndex + 1 === Number(config.questions) ? "Finish test" : "Next question"} →</button></div>
    </div>
  </section> : loading ? <LoadingState label="Generating your test" /> : <section className="tab-panel test-create"><p className="eyebrow">ASSESS YOUR PROGRESS</p><h2>Create a test</h2><div className="test-types">{["MCQ", "Theory"].map((type) => <button key={type} className={config.type === type ? "selected" : ""} onClick={() => setConfig({ ...config, type })}>{type}</button>)}</div><div className="test-config"><label>Difficulty<select value={config.difficulty} onChange={(event) => setConfig({ ...config, difficulty: event.target.value })}><option>Beginner</option><option>Intermediate</option><option>Advanced</option><option>Expert</option></select></label><label>Questions<select value={config.questions} onChange={(event) => setConfig({ ...config, questions: event.target.value })}><option value="5">5</option><option value="10">10</option><option value="20">20</option></select></label><label>Timer (minutes)<select value={config.timer} onChange={(event) => setConfig({ ...config, timer: event.target.value })}><option>10</option><option>20</option><option>30</option></select></label></div><button className="primary-button wide" disabled={!isOnline} onClick={beginTest}>{isOnline ? "Start test" : "Connect to generate test"}</button>{!isOnline && <p className="offline-feature-note">Test generation needs an internet connection.</p>}</section>;
}
