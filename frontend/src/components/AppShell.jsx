import { BookOpen, Flame, LayoutDashboard, Settings } from "lucide-react";
import Logo from "./Logo";

export default function AppShell({ children, page, onNavigate }) {
  const nav = [
    ["dashboard", LayoutDashboard, "Home"],
    ["kits", BookOpen, "Study kits"]
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand-button" onClick={() => onNavigate("dashboard")}><Logo /></button>
        <nav>{nav.map(([id, Icon, label]) => <button key={id} className={page === id ? "active" : ""} onClick={() => onNavigate(id)}><Icon size={19} /><span>{label}</span></button>)}</nav>
        <button className="sidebar-settings"><Settings size={19} /><span>Settings</span></button>
      </aside>
      <main className="app-main">{children}</main>
      <nav className="mobile-nav">{nav.map(([id, Icon, label]) => <button key={id} className={page === id ? "active" : ""} onClick={() => onNavigate(id)}><Icon size={20} /><span>{label}</span></button>)}</nav>
    </div>
  );
}
