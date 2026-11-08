export const apiUrl = (path) => {
  const configuredBase = String(import.meta.env.VITE_API_URL || "").trim();
  const base = (configuredBase || (import.meta.env.DEV ? "http://localhost:4000" : "")).replace(/\/+$/, "");
  const normalizedPath = `/${String(path).replace(/^\/+/, "")}`;
  return `${base}${normalizedPath}`;
};
