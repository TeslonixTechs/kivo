export const apiUrl = (path) => {
  const base = String(import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
  const normalizedPath = `/${String(path).replace(/^\/+/, "")}`;
  return `${base}${normalizedPath}`;
};
