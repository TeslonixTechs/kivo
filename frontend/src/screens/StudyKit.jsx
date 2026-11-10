import { useRef, useState } from "react";
import { ArrowLeft, BookOpen, CircleHelp, FileText, FolderOpen, Sparkles, Trash2, UploadCloud } from "lucide-react";
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

export default function StudyKit({ kit, onNavigate, onUpdate }) {
  const [tab, setTab] = useState("guide");
  const [generating, setGenerating] = useState(false);
  const [guideError, setGuideError] = useState("");
  const [copied, setCopied] = useState(false);
  const input = useRef(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pastedText, setPastedText] = useState("");
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
      ...(guide.quickRevision || [])
    ].filter(Boolean).join("\n\n");
    await navigator.clipboard.writeText(notes);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const tabs = [["guide", BookOpen, "Study guide"], ["materials", FolderOpen, "Materials"], ["smart", Sparkles, "Smart study"], ["test", CircleHelp, "Test"]];
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
              <button className="secondary-button" disabled={generating} onClick={generate}>Regenerate</button>
              <button className="primary-button" onClick={copyNotes}>{copied ? "Copied!" : "Copy notes"}</button>
            </div>
            <StudyNotes guide={kit.guide} />
          </div>
        ) : (
          <div className="generate-state guide-empty-card">
            <div><Sparkles /></div>
            {guideError && <p className="guide-error" role="alert">{guideError}</p>}
            <p>Generate a study guide from your uploaded materials</p>
            <button className="primary-button" disabled={generating} onClick={generate}>
              {guideError ? "Retry" : "Generate study guide"}
            </button>
          </div>
        )}
      </section>
    )}
    {tab === "smart" && <SmartPractice kit={kit} />}
    {tab === "test" && <TestView kit={kit} />}
  </div></AppShell>;
}

function SmartPractice({ kit }) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const loadQuestions = async () => {
    setLoading(true);
    try {
      const result = await requestQuestions({ kit, guide: kit.guide, type: "MCQ", difficulty: kit.difficulty, count: 20 });
      setQuestions(result.questions || []);
      setQuestionIndex(0);
      setAnswer(null);
    } catch (error) {
      console.error("Smart study generation failed:", error);
      window.alert("AI generation failed");
    } finally {
      setLoading(false);
    }
  };
  if (!kit.guide) return <section className="tab-panel generate-state"><div><Sparkles /></div><p className="eyebrow">SMART STUDY</p><h2>Generate your study guide first</h2><p>Smart Study creates questions from the summary that is generated from your uploaded notes.</p></section>;
  if (!questions.length) return <section className="tab-panel practice">{loading ? <LoadingState label="Generating smart study questions" /> : <div className="practice-card practice-launch"><Sparkles /><h2>Practice from your study guide</h2><p>Questions are generated from the key concepts in your uploaded notes.</p><button className="primary-button" onClick={loadQuestions}>Start smart study</button></div>}</section>;
  const question = questions[questionIndex % questions.length];
  const accuracy = answeredCount ? Math.round((correctCount / answeredCount) * 100) : 100;
  const chooseAnswer = (index) => {
    if (answer !== null) return;
    setAnswer(index);
    setAnsweredCount((count) => count + 1);
    if (index === question.answer) setCorrectCount((count) => count + 1);
  };
  const nextQuestion = () => {
    setQuestionIndex((index) => index + 1);
    setAnswer(null);
  };
  return (
    <section className="tab-panel practice">
      <div className="accuracy"><span>Session accuracy</span><strong>{accuracy}%</strong></div>
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
    </section>
  );
}

function TestView({ kit }) {
  const [started, setStarted] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [config, setConfig] = useState({ type: "MCQ", difficulty: "Intermediate", questions: 10, timer: 20 });
  const [testQuestions, setTestQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const options = testQuestions[questionIndex]?.options || [];
  const beginTest = async () => {
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
  </section> : loading ? <LoadingState label="Generating your test" /> : <section className="tab-panel test-create"><p className="eyebrow">ASSESS YOUR PROGRESS</p><h2>Create a test</h2><div className="test-types">{["MCQ", "Theory"].map((type) => <button key={type} className={config.type === type ? "selected" : ""} onClick={() => setConfig({ ...config, type })}>{type}</button>)}</div><div className="test-config"><label>Difficulty<select value={config.difficulty} onChange={(event) => setConfig({ ...config, difficulty: event.target.value })}><option>Beginner</option><option>Intermediate</option><option>Advanced</option><option>Expert</option></select></label><label>Questions<select value={config.questions} onChange={(event) => setConfig({ ...config, questions: event.target.value })}><option value="5">5</option><option value="10">10</option><option value="20">20</option></select></label><label>Timer (minutes)<select value={config.timer} onChange={(event) => setConfig({ ...config, timer: event.target.value })}><option>10</option><option>20</option><option>30</option></select></label></div><button className="primary-button wide" onClick={beginTest}>Start test</button></section>;
}
