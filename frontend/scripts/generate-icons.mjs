import sharp from "sharp";
import { fileURLToPath } from "url";
import path from "path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "public", "kivo-icon.svg");
const output = path.join(root, "public");

await Promise.all([
  sharp(source).resize(192, 192).png().toFile(path.join(output, "icon-192.png")),
  sharp(source).resize(512, 512).png().toFile(path.join(output, "icon-512.png")),
  sharp(source).resize(512, 512).png().toFile(path.join(output, "icon-maskable-512.png"))
]);
