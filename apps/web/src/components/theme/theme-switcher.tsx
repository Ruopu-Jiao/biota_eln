"use client";

import { useSyncExternalStore } from "react";

const storageKey = "biota-theme";
const themeEventName = "biota-theme-change";

type ThemeName = "obsidian" | "paper" | "mist";

const themes: Array<{
  value: ThemeName;
  label: string;
}> = [
  { value: "paper", label: "Light" },
  { value: "obsidian", label: "Dark" },
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

  return "paper";
}

export function ThemeSwitcher() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => "paper");

  return (
    <div className="flex flex-wrap items-center gap-2 border border-[color:var(--line)] bg-[color:var(--surface-muted)] p-2">
      {themes.map((option) => {
        const active = option.value === theme;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              applyTheme(option.value);
            }}
            className={`inline-flex h-9 min-w-[5rem] items-center justify-center border px-3 text-[11px] uppercase tracking-[0.18em] transition ${
              active
                ? "border-[color:var(--accent-soft)] bg-[color:var(--accent-muted)] text-[color:var(--text-primary)]"
                : "border-[color:var(--line)] text-[color:var(--text-muted)] hover:border-[color:var(--line-strong)] hover:text-[color:var(--text-primary)]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
