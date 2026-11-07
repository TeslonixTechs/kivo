import { useState } from "react";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import AppShell from "../components/AppShell";

export default function CreateKit({ onNavigate, onCreated }) {
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState("Intermediate");
  const create = () => {
    if (!title.trim()) return;
    onCreated({ id: crypto.randomUUID(), title: title.trim(), difficulty, materials: [], guide: null, progress: 0, createdAt: new Date().toISOString() });
  };
  return <AppShell page="kits" onNavigate={onNavigate}><div className="create-page"><button className="back-link" onClick={() => onNavigate("dashboard")}><ArrowLeft size={16} /> Back</button><div className="create-card"><div className="create-icon"><Sparkles /></div><p className="eyebrow">NEW STUDY KIT</p><h1>What are you learning?</h1><p>Name the kit and choose the right challenge level.</p><label>Study kit name<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Human Anatomy" /></label><label>Difficulty level</label><div className="difficulty-grid">{["Beginner", "Intermediate", "Advanced", "Expert"].map((level) => <button key={level} className={difficulty === level ? "selected" : ""} onClick={() => setDifficulty(level)}>{level}</button>)}</div><button className="primary-button wide" disabled={!title.trim()} onClick={create}>Create study kit <ArrowRight size={18} /></button></div></div></AppShell>;
}
