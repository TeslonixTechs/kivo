import { useEffect, useMemo, useState } from "react";
import { AlarmClock, BookOpen, CalendarDays, CheckCircle2, Clock3, Search, Target } from "lucide-react";
import AppShell from "../components/AppShell";

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const getWeakTopics = (kit) => {
  const topics = (kit.studyActivity || []).reduce((result, record) => {
    if (!record.correct) result.set(record.topic || "General review", (result.get(record.topic || "General review") || 0) + 1);
    return result;
  }, new Map());
  return [...topics.entries()].sort((a, b) => b[1] - a[1]);
};

const getGuideTermNames = (guide) => {
  const terms = [...(guide?.terms || []), ...(guide?.sections || []).flatMap((section) => section.keyTerms || [])]
    .map((item) => String(item.term || item.word || "").trim())
    .filter(Boolean);
  return terms.filter((term, index) => terms.findIndex((value) => value.toLocaleLowerCase() === term.toLocaleLowerCase()) === index);
};

function Planner({ kits, onUpdateKit, onOpenKit }) {
  const [selectedId, setSelectedId] = useState(kits[0]?.id || "");
  const kit = kits.find((item) => item.id === selectedId) || kits[0];
  if (!kits.length) return <div className="tools-empty"><CalendarDays /><h2>No study kits yet</h2><p>Create a study kit to plan your exam preparation.</p></div>;
  const today = startOfDay(new Date());
  const examDate = kit.examDate ? startOfDay(`${kit.examDate}T00:00:00`) : null;
  const examPassed = Boolean(examDate && examDate < today);
  const daysUntil = examDate ? Math.max(0, Math.ceil((examDate - today) / 86400000)) : 0;
  const sections = (kit.guide?.sections || []).filter((section) => section.heading || section.content);
  const weakTopics = getWeakTopics(kit).slice(0, 4);
  const dueCount = getGuideTermNames(kit.guide).filter((term) => {
    const dueAt = kit.flashcardProgress?.[term.toLocaleLowerCase()]?.dueAt;
    return !dueAt || new Date(dueAt) <= new Date();
  }).length;
  const tasks = [
    ...sections.map((section) => `Review: ${section.heading || "Study guide section"}`),
    ...weakTopics.map(([topic]) => `Revisit: ${topic}`),
    ...(dueCount ? [`Review ${dueCount} due flashcard${dueCount === 1 ? "" : "s"}`] : []),
  ];
  const plan = tasks.map((task, index) => {
    const offset = daysUntil > 0 ? Math.floor(index * (daysUntil + 1) / Math.max(tasks.length, 1)) : 0;
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    return { task, date };
  });
  const saveExamDate = (event) => {
    onUpdateKit({ ...kit, examDate: event.target.value });
  };
  return (
    <div className="tool-content planner-tool">
      <header className="tool-heading"><div><p className="eyebrow">PLAN YOUR PREP</p><h2>Study planner</h2><p>Set an exam date to pace your guide sections, due cards, and topics to revisit.</p></div>
        <label>Study kit<select value={kit.id} onChange={(event) => setSelectedId(event.target.value)}>{kits.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      </header>
      <section className="tool-card planner-date"><CalendarDays /><label htmlFor="exam-date">Exam date</label><input id="exam-date" type="date" min={`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`} value={kit.examDate || ""} onChange={saveExamDate} /><span>{examPassed ? "This exam date has passed" : examDate ? `${daysUntil} day${daysUntil === 1 ? "" : "s"} to go` : "Choose a date to build your plan"}</span></section>
      {!kit.guide ? <p className="tool-note">Generate a study guide to plan your sections and key concepts.</p> : !examDate ? <p className="tool-note">Choose your exam date to see a day-by-day study plan.</p> : examPassed ? <p className="tool-note">Choose a future exam date to build a new plan.</p> : tasks.length ? (
        <section className="tool-card plan-card"><div className="tool-card-heading"><h3>Your plan</h3><span>{tasks.length} study tasks</span></div>
          <ul className="plan-list">{plan.map(({ task, date }, index) => <li key={`${task}-${index}`}><span className="plan-date">{date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span><span>{task}</span></li>)}</ul>
        </section>
      ) : <p className="tool-note">Your study guide has no sections yet, and no flashcards are due.</p>}
      <button className="secondary-button" onClick={() => onOpenKit(kit)}><BookOpen size={17} /> Open {kit.title}</button>
    </div>
  );
}

function Progress({ kits, activities }) {
  const answers = kits.flatMap((kit) => (kit.studyActivity || []).map((record) => ({ ...record, kitTitle: kit.title })));
  const correct = answers.filter((record) => record.correct).length;
  const accuracy = answers.length ? Math.round((correct / answers.length) * 100) : null;
  const sessions = activities.filter((item) => item.type === "focus-session");
  const seconds = sessions.reduce((sum, item) => sum + (Number(item.durationSeconds) || 0), 0);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = startOfDay(new Date());
    date.setDate(date.getDate() - (6 - index));
    const minutes = sessions.filter((session) => startOfDay(session.createdAt).getTime() === date.getTime())
      .reduce((sum, session) => sum + (Number(session.durationSeconds) || 0) / 60, 0);
    return { date, minutes };
  });
  const best = Math.max(...days.map((day) => day.minutes), 1);
  const topicStats = answers.reduce((map, record) => {
    const topic = record.topic || "General review";
    const value = map.get(topic) || { missed: 0, attempts: 0 };
    value.attempts += 1;
    if (!record.correct) value.missed += 1;
    map.set(topic, value);
    return map;
  }, new Map());
  const weakTopics = [...topicStats.entries()].filter(([, value]) => value.missed)
    .sort((a, b) => b[1].missed - a[1].missed).slice(0, 5);
  return (
    <div className="tool-content">
      <header className="tool-heading"><div><p className="eyebrow">YOUR LEARNING</p><h2>Progress</h2><p>Based only on saved practice answers and completed focus sessions.</p></div></header>
      <div className="progress-stats">
        <article className="tool-card"><CheckCircle2 /><span>Smart Study answers</span><strong>{answers.length}</strong></article>
        <article className="tool-card"><Target /><span>Answer accuracy</span><strong>{accuracy === null ? "—" : `${accuracy}%`}</strong></article>
        <article className="tool-card"><Clock3 /><span>Focused study time</span><strong>{Math.floor(seconds / 3600)}h {Math.floor((seconds % 3600) / 60)}m</strong></article>
        <article className="tool-card"><AlarmClock /><span>Focus sessions</span><strong>{sessions.length}</strong></article>
      </div>
      <section className="tool-card"><div className="tool-card-heading"><h3>Focus time · last 7 days</h3><span>Minutes</span></div>
        <div className="progress-chart" role="img" aria-label="Daily focus time for the last seven days">{days.map((day) => <div key={day.date.toISOString()}><div className="progress-bar-track"><span style={{ height: `${Math.max(day.minutes ? 8 : 0, day.minutes / best * 100)}%` }} /></div><small>{day.date.toLocaleDateString(undefined, { weekday: "short" })}</small><small>{Math.round(day.minutes)}m</small></div>)}</div>
      </section>
      <section className="tool-card"><div className="tool-card-heading"><h3>Topics to revisit</h3><span>From incorrect answers</span></div>
        {weakTopics.length ? <ul className="plan-list">{weakTopics.map(([topic, value]) => <li key={topic}><span>{value.missed} missed</span><span>{topic} · {value.attempts} attempt{value.attempts === 1 ? "" : "s"}</span></li>)}</ul> : <p className="tool-note">Answer Smart Study questions to see topics that may need more practice.</p>}
      </section>
    </div>
  );
}

const guideParts = (kit) => {
  const guide = kit.guide || {};
  return [
    ["Study kit", kit.title],
    ["Guide title", guide.title],
    ["Overview", guide.overview],
    ...(guide.sections || []).flatMap((section) => [
      [section.heading || "Study guide section", `${section.heading || ""} ${section.content || ""}`],
      ...(section.points || []).map((point) => ["Key point", point]),
      ...(section.keyTerms || []).map((term) => [term.term || term.word || "Key term", `${term.term || term.word || ""}: ${term.meaning || ""}`]),
    ]),
    ...(guide.terms || []).map((term) => [term.term || term.word || "Key term", `${term.term || term.word || ""}: ${term.meaning || ""}`]),
    ...(guide.quickRevision || []).map((point) => ["Quick revision", point]),
  ].filter(([, text]) => typeof text === "string" && text.trim());
};

function SearchGuides({ kits, onOpenKit }) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return [];
    return kits.flatMap((kit) => guideParts(kit).flatMap(([label, text]) => {
      const position = text.toLocaleLowerCase().indexOf(normalized);
      if (position < 0) return [];
      const start = Math.max(0, position - 65);
      const end = Math.min(text.length, position + normalized.length + 95);
      return [{ kit, label, snippet: `${start ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}` }];
    })).slice(0, 40);
  }, [kits, query]);
  return (
    <div className="tool-content">
      <header className="tool-heading"><div><p className="eyebrow">SEARCH YOUR LIBRARY</p><h2>Find in study guides</h2><p>Search overview text, sections, key terms, and quick revision notes.</p></div></header>
      <label className="guide-search"><Search size={19} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a concept or term…" /></label>
      {!query.trim() ? <p className="tool-note">Enter a word or phrase to search all saved study guides.</p> : matches.length ? <div className="search-results">{matches.map((result, index) => <button key={`${result.kit.id}-${result.label}-${index}`} className="tool-card search-result" onClick={() => onOpenKit(result.kit)}><span><strong>{result.kit.title}</strong><small>{result.label}</small></span><p>{result.snippet}</p></button>)}</div> : <p className="tool-note">No matching text found in your saved guides.</p>}
    </div>
  );
}

function FocusTimer({ onAddActivity }) {
  const [minutes, setMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(minutes * 60);
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [restored] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("kivo:focus-timer") || "null");
    } catch (error) {
      console.error("Saved focus timer could not be restored:", error);
      return null;
    }
  });
  useEffect(() => {
    if (restored && Number.isFinite(restored.secondsLeft) && [15, 25, 45, 60].includes(restored.minutes)) {
      setMinutes(restored.minutes);
      setSecondsLeft(restored.secondsLeft);
      setStartedAt(restored.startedAt);
      setRunning(Boolean(restored.running));
    }
  }, [restored]);
  useEffect(() => {
    sessionStorage.setItem("kivo:focus-timer", JSON.stringify({ minutes, secondsLeft, startedAt, running }));
  }, [minutes, secondsLeft, startedAt, running]);
  useEffect(() => {
    if (!running) return undefined;
    const id = window.setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  const finish = async (completed) => {
    setRunning(false);
    const durationSeconds = completed ? minutes * 60 : Math.max(0, minutes * 60 - secondsLeft);
    if (durationSeconds > 0) {
      try {
        await onAddActivity({ type: "focus-session", durationSeconds, startedAt: new Date(startedAt || Date.now()).toISOString() });
      } catch (error) {
        console.error("Focus session could not be saved:", error);
        setSaveError("Your completed focus session could not be saved.");
      }
    }
    setSecondsLeft(minutes * 60);
    setStartedAt(null);
    sessionStorage.removeItem("kivo:focus-timer");
  };
  useEffect(() => {
    if (running && secondsLeft === 0) void finish(true);
  }, [running, secondsLeft]);
  const toggle = () => {
    if (running) {
      setRunning(false);
      return;
    }
    if (secondsLeft <= 0) setSecondsLeft(minutes * 60);
    setStartedAt((value) => value || Date.now());
    setRunning(true);
    setSaveError("");
  };
  const chooseMinutes = (value) => {
    setRunning(false);
    setMinutes(value);
    setSecondsLeft(value * 60);
    setStartedAt(null);
  };
  const formatted = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;
  return (
    <div className="tool-content focus-tool">
      <header className="tool-heading"><div><p className="eyebrow">FOCUS MODE</p><h2>Focus session</h2><p>Take a short, distraction-free session. Completed time is added to your progress.</p></div></header>
      <section className="tool-card timer-card"><Clock3 />
        <div className="timer-display" role="timer" aria-live="off">{formatted}</div>
        <div className="timer-presets" aria-label="Session length">{[15, 25, 45, 60].map((value) => <button key={value} className={minutes === value ? "selected" : ""} disabled={running} onClick={() => chooseMinutes(value)}>{value} min</button>)}</div>
        <div className="timer-actions"><button className="primary-button" onClick={toggle}>{running ? "Pause session" : "Start focusing"}</button>{(running || secondsLeft !== minutes * 60) && <button className="secondary-button" onClick={() => finish(false)}>Finish early</button>}</div>
        {saveError && <p className="flashcard-error" role="alert">{saveError}</p>}
        <p className="tool-note">Completed sessions only count toward your study-time totals.</p>
      </section>
    </div>
  );
}

export default function Tools({ kits, activities, onUpdateKit, onAddActivity, onOpenKit, onNavigate }) {
  const [tab, setTab] = useState("planner");
  const tabs = [
    ["planner", CalendarDays, "Planner"],
    ["progress", Target, "Progress"],
    ["focus", Clock3, "Focus"],
    ["search", Search, "Search"],
  ];
  return (
    <AppShell page="tools" onNavigate={onNavigate}>
      <main className="tools-page">
        <header className="tools-page-heading"><p className="eyebrow">STUDY TOOLS</p><h1>Make learning stick.</h1></header>
        <nav className="tools-tabs" aria-label="Study tools">{tabs.map(([id, Icon, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><Icon size={17} />{label}</button>)}</nav>
        {tab === "planner" && <Planner kits={kits} onUpdateKit={onUpdateKit} onOpenKit={onOpenKit} />}
        {tab === "progress" && <Progress kits={kits} activities={activities} />}
        {tab === "focus" && <FocusTimer onAddActivity={onAddActivity} />}
        {tab === "search" && <SearchGuides kits={kits} onOpenKit={onOpenKit} />}
      </main>
    </AppShell>
  );
}
