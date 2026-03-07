"use client";

import { useEffect, useState } from "react";

type ThemeName = "clinico" | "oceano" | "bosque" | "arena";

const STORAGE_KEY = "hcv_theme";

const options: Array<{ value: ThemeName; label: string }> = [
  { value: "clinico", label: "Clinico" },
  { value: "oceano", label: "Oceano" },
  { value: "bosque", label: "Bosque" },
  { value: "arena", label: "Arena" }
];

function applyTheme(theme: ThemeName) {
  document.documentElement.setAttribute("data-theme", theme);
}

export default function ThemeSelector() {
  const [theme, setTheme] = useState<ThemeName>("clinico");

  useEffect(() => {
    const stored = (window.localStorage.getItem(STORAGE_KEY) as ThemeName | null) ?? "clinico";
    setTheme(stored);
    applyTheme(stored);
  }, []);

  return (
    <div className="row" style={{ gap: 6 }}>
      <label htmlFor="theme-select" className="small" style={{ margin: 0 }}>
        Tema
      </label>
      <select
        id="theme-select"
        className="theme-select"
        value={theme}
        onChange={(event) => {
          const next = event.target.value as ThemeName;
          setTheme(next);
          applyTheme(next);
          window.localStorage.setItem(STORAGE_KEY, next);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
