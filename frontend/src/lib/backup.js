import JSZip from "jszip";

export async function readBackup(file) {
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
  if (!manifest || typeof manifest !== "object" || manifest.format !== "kivo-backup" || manifest.version !== 1 || !Array.isArray(manifest.kits)) {
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
    return { ...kit, materials };
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
