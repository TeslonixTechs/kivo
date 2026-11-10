import { useRef, useState } from "react";
import { Check, Download, Moon, RotateCcw, Sun, Upload } from "lucide-react";
import JSZip from "jszip";
import AppShell from "../components/AppShell";

const downloadBlob = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};

async function createBackup(profile, kits, activities) {
  const zip = new JSZip();
  const manifestKits = await Promise.all(kits.map(async (kit) => {
    const materials = await Promise.all((kit.materials || []).map(async (material) => {
      const { blob, ...metadata } = material;
      if (blob instanceof Blob) {
        const path = `materials/${encodeURIComponent(kit.id)}/${encodeURIComponent(material.id || material.name)}`;
        zip.file(path, blob);
        return { ...metadata, backupPath: path };
      }
      return metadata;
    }));
    return { ...kit, materials };
  }));
  zip.file("manifest.json", JSON.stringify({ format: "kivo-backup", version: 1, exportedAt: new Date().toISOString(), profile, kits: manifestKits, activities }));
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

async function readBackup(file) {
  if (!file || file.size > 200 * 1024 * 1024) throw new Error("Choose a backup ZIP smaller than 200 MB.");
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) throw new Error("This ZIP does not contain a Kivo backup manifest.");
  let manifest;
  try {
    manifest = JSON.parse(await manifestFile.async("text"));
  } catch {
    throw new Error("The backup manifest is not valid JSON.");
  }
  if (manifest.format !== "kivo-backup" || manifest.version !== 1 || !Array.isArray(manifest.kits)) {
    throw new Error("This backup format or version is not supported.");
  }
  if (manifest.kits.length > 1000) throw new Error("This backup contains too many study kits.");
  if (manifest.activities !== undefined && (!Array.isArray(manifest.activities) || manifest.activities.length > 10000)) {
    throw new Error("The activity history in this backup is invalid.");
  }
  const kits = await Promise.all(manifest.kits.map(async (kit) => {
    if (!kit || typeof kit.id !== "string" || typeof kit.title !== "string" || !Array.isArray(kit.materials)) {
      throw new Error("A study kit in this backup is invalid.");
    }
    const materials = await Promise.all(kit.materials.map(async (material) => {
      if (!material || typeof material.name !== "string") throw new Error(`A material in "${kit.title}" is invalid.`);
      if (!material.backupPath) return material;
      if (typeof material.backupPath !== "string" || !material.backupPath.startsWith("materials/")) {
        throw new Error(`A material path in "${kit.title}" is invalid.`);
      }
      const archiveFile = zip.file(material.backupPath);
      if (!archiveFile) throw new Error(`A material file is missing from "${kit.title}".`);
      const bytes = await archiveFile.async("uint8array");
      const { backupPath, ...metadata } = material;
      return { ...metadata, blob: new Blob([bytes], { type: material.type || "application/octet-stream" }) };
    }));
    const { savedMaterials, ...kitData } = kit;
    return { ...kitData, materials };
  }));
  const profile = manifest.profile && typeof manifest.profile === "object" ? manifest.profile : null;
  const activities = (manifest.activities || []).map((item) => {
    if (!item || typeof item.id !== "string" || typeof item.type !== "string") {
      throw new Error("An activity record in this backup is invalid.");
    }
    return item;
  });
  return { profile, kits, activities };
}

export default function Settings({
  profile, theme, onThemeChange, textScale, onTextScaleChange, highContrast, onHighContrastChange,
  kits, activities, onRestoreBackup, onNavigate,
}) {
  const fileInput = useRef(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const clearLocalData = async () => {
    if (!window.confirm("Reset Kivo? This removes study kits and materials stored on this device.")) return;
    await indexedDB.deleteDatabase("kivo");
    window.location.reload();
  };
  const exportBackup = async () => {
    setBackupBusy(true);
    setBackupMessage("");
    try {
      const backup = await createBackup(profile, kits, activities);
      downloadBlob(backup, `kivo-backup-${new Date().toISOString().slice(0, 10)}.zip`);
      setBackupMessage("Your Kivo backup is ready to download.");
    } catch (error) {
      console.error("Kivo backup could not be created:", error);
      setBackupMessage("The backup could not be created. Please try again.");
    } finally {
      setBackupBusy(false);
    }
  };
  const importBackup = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBackupBusy(true);
    setBackupMessage("");
    try {
      const backup = await readBackup(file);
      const profileNotice = backup.profile ? " Your current learning profile will be replaced." : "";
      const confirmed = window.confirm(`Restore ${backup.kits.length} study kit${backup.kits.length === 1 ? "" : "s"} and ${backup.activities.length} activity record${backup.activities.length === 1 ? "" : "s"}? Existing kits will be kept and duplicates will be added as separate copies.${profileNotice}`);
      if (!confirmed) return;
      await onRestoreBackup(backup);
      setBackupMessage(`Restored ${backup.kits.length} study kit${backup.kits.length === 1 ? "" : "s"}.`);
    } catch (error) {
      console.error("Kivo backup could not be restored:", error);
      setBackupMessage(error.message || "The selected file could not be restored.");
    } finally {
      setBackupBusy(false);
    }
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
        <section className="settings-card accessibility-card">
          <div className="settings-section-heading"><div><h2>Accessibility</h2><p>Adjust reading comfort and contrast throughout Kivo.</p></div></div>
          <label>Text size<select value={textScale} onChange={(event) => onTextScaleChange(event.target.value)}><option value="normal">Default</option><option value="large">Large</option><option value="larger">Extra large</option></select></label>
          <label className="settings-toggle"><span><strong>High contrast</strong><small>Strengthen text and control contrast.</small></span><input type="checkbox" checked={highContrast} onChange={(event) => onHighContrastChange(event.target.checked)} /></label>
          <p>Use your device’s screen reader to read controls and study content; interactive controls include accessible names.</p>
        </section>
        <section className="settings-card backup-card">
          <div className="settings-section-heading"><div><h2>Backup and restore</h2><p>Export your profile, study kits, guides, review progress, and uploaded files.</p></div></div>
          <div className="backup-actions"><button className="primary-button" disabled={backupBusy} onClick={exportBackup}><Download size={17} /> Download backup</button><button className="secondary-button" disabled={backupBusy} onClick={() => fileInput.current?.click()}><Upload size={17} /> Restore backup</button><input ref={fileInput} type="file" accept=".zip,application/zip" hidden onChange={importBackup} /></div>
          {backupMessage && <p className="backup-message" role="status">{backupMessage}</p>}
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
