import { ArrowRight, ChevronRight, Clock3, Flame, FolderOpen, Plus, Sparkles } from "lucide-react";
import AppShell from "../components/AppShell";

export default function Dashboard({ profile, kits, streak, onNavigate, onOpenKit, onCreate }) {
  return (
    <AppShell page="dashboard" onNavigate={onNavigate}>
      <div className="dashboard">
        <header className="dashboard-header"><div><p className="eyebrow">MONDAY, NOVEMBER 5</p><h1>Welcome back, {profile.name?.split(" ")[0] || "learner"}</h1><p>Your learning momentum is building.</p></div><button className="streak-pill"><Flame size={19} fill="currentColor" /><strong>{streak}</strong><span>day streak</span></button></header>
        <section className="hero-card"><div><p className="eyebrow">CONTINUE LEARNING</p><h2>Make your next study session count.</h2><p>Turn your materials into focused guides, practice, and tests.</p><button onClick={onCreate}>Create study kit <ArrowRight size={17} /></button></div><div className="hero-art"><div /><Sparkles /></div></section>
        <div className="dashboard-grid">
          <section><div className="section-title"><div><p className="eyebrow">YOUR LIBRARY</p><h2>Study kits</h2></div><button onClick={onCreate}><Plus size={17} /> New kit</button></div>
            {kits.length === 0 ? <div className="empty-dashboard"><FolderOpen /><h3>Start your first kit</h3><p>Add a title and your course materials.</p><button className="primary-button" onClick={onCreate}>Create study kit</button></div> :
              <div className="kit-list">{kits.slice(0, 6).map((kit, index) => <button key={kit.id} className={`kit-row kit-color-${index % 3}`} onClick={() => onOpenKit(kit)}><div className="kit-row-icon"><FolderOpen size={20} /></div><div><strong>{kit.title}</strong><span>{kit.materials?.length || 0} materials · {kit.difficulty}</span></div><ChevronRight size={18} /></button>)}</div>}
          </section>
          <aside className="insights"><div className="section-title"><h2>Weekly focus</h2></div><div className="focus-card"><div><Clock3 /><strong>0h 0m</strong><span>Study time</span></div><div><strong>0</strong><span>Tests taken</span></div></div><div className="mini-activity"><Sparkles /><div><strong>Ready for your first session</strong><span>Create a kit to begin.</span></div></div></aside>
        </div>
      </div>
    </AppShell>
  );
}
