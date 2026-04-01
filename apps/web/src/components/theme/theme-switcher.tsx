"use client";

import { useEffect, useState } from "react";

const storageKey = "biota-theme";

type ThemeName = "obsidian" | "paper" | "mist";

const themes: Array<{
  value: ThemeName;
  label: string;
}> = [
  { value: "obsidian", label: "Dark" },
  { value: "paper", label: "Light" },
  { value: "mist", label: "Mist" },
];

function isThemeName(value: string | null): value is ThemeName {
  return value === "obsidian" || value === "paper" || value === "mist";
}

function applyTheme(theme: ThemeName) {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(storageKey, theme);
}

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeName>(() => {
    if (typeof document === "undefined") {
      return "obsidian";
    }

    const storedTheme = window.localStorage.getItem(storageKey);

    if (isThemeName(storedTheme)) {
      return storedTheme;
    }

    const domTheme = document.documentElement.dataset.theme ?? null;

    if (isThemeName(domTheme)) {
      return domTheme;
    }

    return "obsidian";
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <div className="flex items-center gap-1.5 border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-1.5 py-1">
      {themes.map((option) => {
        const active = option.value === theme;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              setTheme(option.value);
              applyTheme(option.value);
            }}
            className={`px-2.5 py-1.5 text-[11px] uppercase tracking-[0.18em] transition ${
              active
                ? "bg-[color:var(--accent-muted)] text-[color:var(--text-primary)]"
                : "text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
