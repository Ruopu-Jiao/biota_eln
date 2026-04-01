export type UIThemeMode = "light" | "dark" | "system";

export interface NavItem {
  label: string;
  href: string;
  active?: boolean;
}
