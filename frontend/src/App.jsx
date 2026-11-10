import { useCallback, useEffect, useState } from "react";
import SplashScreen from "./components/SplashScreen";
import Onboarding from "./screens/Onboarding";
import Dashboard from "./screens/Dashboard";
import CreateKit from "./screens/CreateKit";
import StudyKit from "./screens/StudyKit";
import Tools from "./screens/Tools";
import { db } from "./lib/db";
import Settings from "./screens/Settings";
import LoadingState from "./components/LoadingState";

export default function App() {
  const [booting, setBooting] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem("kivo:theme") || "light");
  const [profile, setProfile] = useState(null);
  const [kits, setKits] = useState([]);
  const [activities, setActivities] = useState([]);
  const [screen, setScreen] = useState("dashboard");
  const [selected, setSelected] = useState(null);
  const [textScale, setTextScale] = useState(localStorage.getItem("kivo:text-scale") || "normal");
  const [highContrast, setHighContrast] = useState(localStorage.getItem("kivo:high-contrast") === "true");
  const finishSplash = useCallback(() => {
    setBooting(false);
  }, []);

  useEffect(() => {
    Promise.all([db.profile.get(), db.kits.all(), db.activity.all()]).then(([savedProfile, savedKits, savedActivities]) => {
      setProfile(savedProfile || null);
      setKits((savedKits || []).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")));
      setActivities(savedActivities || []);
      setLoadingProfile(false);
    });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("kivo:theme", theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.textScale = textScale;
    document.documentElement.dataset.highContrast = String(highContrast);
    localStorage.setItem("kivo:text-scale", textScale);
    localStorage.setItem("kivo:high-contrast", String(highContrast));
  }, [textScale, highContrast]);

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
  const addActivity = async (item) => {
    const saved = await db.activity.add(item);
    setActivities((current) => [...current, saved]);
  };
  const restoreBackup = async ({ profile: importedProfile, kits: importedKits, activities: importedActivities = [] }) => {
    const existingIds = new Set(kits.map((kit) => kit.id));
    const restoredKits = importedKits.map((kit) => {
      const restored = existingIds.has(kit.id) ? { ...kit, id: crypto.randomUUID() } : kit;
      existingIds.add(restored.id);
      return restored;
    });
    for (const kit of restoredKits) await db.kits.save(kit);
    if (importedProfile) {
      await db.profile.save(importedProfile);
      setProfile(importedProfile);
    }
    const activityIds = new Set(activities.map((item) => item.id));
    const restoredActivities = [];
    for (const activity of importedActivities) {
      if (activityIds.has(activity.id)) continue;
      activityIds.add(activity.id);
      restoredActivities.push(await db.activity.add(activity));
    }
    setKits((current) => [...restoredKits, ...current]);
    setActivities((current) => [...restoredActivities, ...current]);
  };
  const importStudyKits = async (importedKits) => {
    const existingIds = new Set(kits.map((kit) => kit.id));
    const restoredKits = importedKits.map((kit) => {
      const restored = existingIds.has(kit.id) ? { ...kit, id: crypto.randomUUID() } : kit;
      existingIds.add(restored.id);
      return restored;
    });
    for (const kit of restoredKits) await db.kits.save(kit);
    setKits((current) => [...restoredKits, ...current]);
    setSelected(restoredKits[0]);
    setScreen("kit");
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
  if (screen === "settings") return <Settings profile={profile} theme={theme} onThemeChange={setTheme} textScale={textScale} onTextScaleChange={setTextScale} highContrast={highContrast} onHighContrastChange={setHighContrast} kits={kits} activities={activities} onRestoreBackup={restoreBackup} onNavigate={setScreen} />;
  if (screen === "tools") return <Tools kits={kits} activities={activities} onUpdateKit={updateKit} onAddActivity={addActivity} onOpenKit={(kit) => { setSelected(kit); setScreen("kit"); }} onNavigate={setScreen} />;
  return <Dashboard profile={profile} kits={kits} activities={activities} streak={0} onNavigate={setScreen} onCreate={() => setScreen("create")} onDeleteKit={deleteKit} onOpenKit={(kit) => { setSelected(kit); setScreen("kit"); }} onImportKits={importStudyKits} />;
}
