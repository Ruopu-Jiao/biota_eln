"use client";

import { useSyncExternalStore } from "react";

const storageKey = "biota-theme";
const themeEventName = "biota-theme-change";

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
  window.dispatchEvent(new Event(themeEventName));
}

function subscribe(callback: () => void) {
  const handleChange = () => callback();

  window.addEventListener("storage", handleChange);
  window.addEventListener(themeEventName, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(themeEventName, handleChange);
  };
}

function getSnapshot(): ThemeName {
  const storedTheme = window.localStorage.getItem(storageKey);
  const domTheme = document.documentElement.dataset.theme ?? null;

  if (isThemeName(storedTheme)) {
    return storedTheme;
  }

  if (isThemeName(domTheme)) {
    return domTheme;
  }

  return "obsidian";
}

export function ThemeSwitcher() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => "obsidian");

  return (
    <div className="flex items-center gap-1.5 border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-1.5 py-1">
      {themes.map((option) => {
        const active = option.value === theme;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => {
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
