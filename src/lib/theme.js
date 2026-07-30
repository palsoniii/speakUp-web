import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "speakup:theme";

function resolveInitialTheme() {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

// Theme lives on document.documentElement (not some inner wrapper) —
// putting `data-theme` there means every element's default (unset) `color`
// resolves the right palette via inheritance from <html>, with nothing
// outside the themed subtree to accidentally fall back to light. See the
// design handoff's "Theming implementation notes" for the bug this avoids.
export function useTheme() {
  const [theme, setTheme] = useState(resolveInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }, []);

  return { theme, setTheme, toggleTheme };
}
