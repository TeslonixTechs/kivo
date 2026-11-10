import { ArrowRight, ChevronRight, Clock3, Flame, FolderOpen, Plus, Sparkles, Trash2 } from "lucide-react";
import AppShell from "../components/AppShell";

export default function Dashboard({ profile, kits, activities = [], streak, onNavigate, onOpenKit, onCreate, onDeleteKit }) {
  const focusSessions = activities.filter((item) => item.type === "focus-session");
  const focusedMinutes = Math.round(focusSessions.reduce((total, item) => total + (Number(item.durationSeconds) || 0), 0) / 60);
  const answers = kits.reduce((total, kit) => total + (kit.studyActivity || []).length, 0);
  const todayLabel = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  return (
    <AppShell page="dashboard" onNavigate={onNavigate}>
      <div className="dashboard">
        <header className="dashboard-header"><div><p className="eyebrow">{todayLabel}</p><h1>Welcome back, {profile.name?.split(" ")[0] || "learner"}</h1><p>Your learning momentum is building.</p></div><button className="streak-pill"><Flame size={19} fill="currentColor" /><strong>{streak}</strong><span>day streak</span></button></header>
        <section className="hero-card"><div><p className="eyebrow">CONTINUE LEARNING</p><h2>Make your next study session count.</h2><p>Turn your materials into focused guides, practice, and tests.</p><button onClick={onCreate}>Create study kit <ArrowRight size={17} /></button></div><div className="hero-art"><div /><Sparkles /></div></section>
        <div className="dashboard-grid">
          <section><div className="section-title"><div><p className="eyebrow">YOUR LIBRARY</p><h2>Study kits</h2></div><button onClick={onCreate}><Plus size={17} /> New kit</button></div>
            {kits.length === 0 ? <div className="empty-dashboard"><FolderOpen /><h3>Start your first kit</h3><p>Add a title and your course materials.</p><button className="primary-button" onClick={onCreate}>Create study kit</button></div> :
              <div className="kit-list">{kits.slice(0, 6).map((kit, index) => <div key={kit.id} className={`kit-row kit-color-${index % 3}`}><button className="kit-row-main" onClick={() => onOpenKit(kit)}><div className="kit-row-icon"><FolderOpen size={20} /></div><div><strong>{kit.title}</strong><span>{kit.materials?.length || 0} materials · {kit.difficulty}</span></div><ChevronRight size={18} /></button><button className="delete-kit" aria-label={`Delete ${kit.title}`} onClick={() => { if (window.confirm(`Delete "${kit.title}" and all of its materials?`)) onDeleteKit(kit.id); }}><Trash2 size={17} /></button></div>)}</div>}
          </section>
          <aside className="insights"><div className="section-title"><h2>Your progress</h2><button onClick={() => onNavigate("tools")}>Study tools <ArrowRight size={15} /></button></div><div className="focus-card"><div><Clock3 /><strong>{Math.floor(focusedMinutes / 60)}h {focusedMinutes % 60}m</strong><span>Focus time</span></div><div><strong>{answers}</strong><span>Answers practiced</span></div></div><div className="mini-activity"><Sparkles /><div><strong>{focusSessions.length || answers ? "Keep your momentum" : "Ready for your first session"}</strong><span>{focusSessions.length || answers ? `${focusSessions.length} completed focus session${focusSessions.length === 1 ? "" : "s"}` : "Plan, practice, and track your progress."}</span></div></div></aside>
        </div>
      </div>
    </AppShell>
  );
}
