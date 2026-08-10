export const THEME_STORAGE_KEY = "cbmove-theme";

export type AppTheme = "light" | "dark";

export function resolveTheme(stored: string | null): AppTheme {
  return stored === "dark" ? "dark" : "light";
}

export function applyThemeClass(theme: AppTheme) {
  const root = document.documentElement;
  root.classList.remove("dark");
  if (theme === "dark") root.classList.add("dark");
}

export function normalizeStoredTheme(): AppTheme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const resolved = resolveTheme(stored);
    if (stored !== resolved) {
      localStorage.setItem(THEME_STORAGE_KEY, resolved);
    }
    return resolved;
  } catch {
    return "light";
  }
}

/** Script inline no HTML — evita flash de tema antes do React hidratar. */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var k="${THEME_STORAGE_KEY}";var t=localStorage.getItem(k);if(t!=="dark"){localStorage.setItem(k,"light");t="light"}document.documentElement.classList.remove("dark");if(t==="dark")document.documentElement.classList.add("dark")}catch(e){document.documentElement.classList.remove("dark");try{localStorage.setItem("${THEME_STORAGE_KEY}","light")}catch(_){}}})();`;
