import { useEffect, useState } from "react";
import { DownloadCloud, WifiOff } from "lucide-react";

export default function PwaExperience() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const ready = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const installed = () => setInstallPrompt(null);
    const online = () => setOffline(false);
    const offline = () => setOffline(true);
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", installed);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", installed);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallPrompt(null);
  };

  return (
    <>
      {offline && <div className="offline-banner" role="status"><WifiOff size={18} />You're offline. Saved notes are still available.</div>}
      {installPrompt && <button className="install-app-button" onClick={install}><DownloadCloud size={17} />Install app</button>}
    </>
  );
}
