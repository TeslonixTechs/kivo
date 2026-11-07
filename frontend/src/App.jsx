import { useCallback, useEffect, useState } from "react";
import SplashScreen from "./components/SplashScreen";
import Onboarding from "./screens/Onboarding";
import Dashboard from "./screens/Dashboard";
import CreateKit from "./screens/CreateKit";
import StudyKit from "./screens/StudyKit";
import { db } from "./lib/db";
import Settings from "./screens/Settings";
import LoadingState from "./components/LoadingState";

export default function App() {
  const [booting, setBooting] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem("kivo:theme") || "light");
  const [profile, setProfile] = useState(null);
  const [kits, setKits] = useState([]);
  const [screen, setScreen] = useState("dashboard");
  const [selected, setSelected] = useState(null);
  const finishSplash = useCallback(() => {
    setBooting(false);
  }, []);

  useEffect(() => {
    Promise.all([db.profile.get(), db.kits.all()]).then(([savedProfile, savedKits]) => {
      setProfile(savedProfile || null);
      setKits((savedKits || []).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")));
      setLoadingProfile(false);
    });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("kivo:theme", theme);
  }, [theme]);

  const completeOnboarding = async (details) => {
    await db.profile.save(details);
    setProfile(details);
  };
  const createKit = async (kit) => {
    await db.kits.save(kit);
    await db.activity.add({ action: "Created study kit", detail: kit.title });
    setKits((current) => [kit, ...current]);
    setSelected(kit);
    setScreen("kit");
  };
  const updateKit = async (kit) => {
    await db.kits.save(kit);
    setKits((current) => current.map((item) => item.id === kit.id ? kit : item));
    setSelected(kit);
  };
  const deleteKit = async (id) => {
    await db.kits.remove(id);
    setKits((current) => current.filter((kit) => kit.id !== id));
    if (selected?.id === id) setSelected(null);
    setScreen("dashboard");
  };

  if (booting) return <SplashScreen onComplete={finishSplash} />;
  if (loadingProfile) return <LoadingState />;
  if (!profile) return <Onboarding onComplete={completeOnboarding} />;
  if (screen === "kit" && selected) return <StudyKit kit={selected} onNavigate={setScreen} onUpdate={updateKit} />;
  if (screen === "create") return <CreateKit onNavigate={setScreen} onCreated={createKit} />;
  if (screen === "settings") return <Settings profile={profile} theme={theme} onThemeChange={setTheme} onNavigate={setScreen} />;
  return <Dashboard profile={profile} kits={kits} streak={0} onNavigate={setScreen} onCreate={() => setScreen("create")} onDeleteKit={deleteKit} onOpenKit={(kit) => { setSelected(kit); setScreen("kit"); }} />;
}
