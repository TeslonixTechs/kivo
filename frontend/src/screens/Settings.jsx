import { Check, Moon, RotateCcw, Sun } from "lucide-react";
import AppShell from "../components/AppShell";

export default function Settings({ profile, theme, onThemeChange, onNavigate }) {
  const clearLocalData = async () => {
    if (!window.confirm("Reset Kivo? This removes study kits and materials stored on this device.")) return;
    await indexedDB.deleteDatabase("kivo");
    window.location.reload();
  };
  return (
    <AppShell page="settings" onNavigate={onNavigate}>
      <div className="settings-page">
        <header><p className="eyebrow">PERSONALIZE KIVO</p><h1>Settings</h1></header>
        <section className="settings-card">
          <div className="settings-section-heading"><div><h2>Appearance</h2><p>Choose how Kivo looks on this device.</p></div></div>
          <div className="theme-options">
            <button className={theme === "light" ? "selected" : ""} onClick={() => onThemeChange("light")}><Sun /><span><strong>Light</strong><small>Cloud White theme</small></span>{theme === "light" && <Check />}</button>
            <button className={theme === "dark" ? "selected" : ""} onClick={() => onThemeChange("dark")}><Moon /><span><strong>Dark</strong><small>Midnight Navy theme</small></span>{theme === "dark" && <Check />}</button>
          </div>
        </section>
        <section className="settings-card">
          <div className="settings-section-heading"><div><h2>Learning profile</h2><p>These details personalize your study space.</p></div></div>
          <div className="profile-summary"><div className="profile-avatar">{profile.name?.[0]?.toUpperCase() || "K"}</div><div><strong>{profile.name}</strong><span>{profile.goal}</span></div><small>{profile.level}</small></div>
        </section>
        <section className="settings-card danger-card">
          <div><h2>Reset local data</h2><p>Delete study kits, materials, and profile information from this device.</p></div>
          <button onClick={clearLocalData}><RotateCcw size={17} /> Reset Kivo</button>
        </section>
      </div>
    </AppShell>
  );
}
