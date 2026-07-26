export interface ThemeDefinition {
  id: string;
  label: string;
  colors: Record<string, string>;
}

export const DEFAULT_THEME_ID = "gruvbox-dark";

export const THEMES: ThemeDefinition[] = [
  {
    id: "gruvbox-dark",
    label: "Gruvbox Dark",
    colors: {
      "--color-surface": "#282828",
      "--color-surface-raised": "#32302f",
      "--color-surface-overlay": "#3c3836",
      "--color-border": "#504945",
      "--color-text": "#ebdbb2",
      "--color-text-muted": "#a89984",
      "--color-accent": "#fe8019",
      "--color-accent-hover": "#fabd2f",
      "--color-success": "#b8bb26",
      "--color-warning": "#fabd2f",
      "--color-danger": "#fb4934",
    },
  },
  {
    id: "curse-book",
    label: "Curse Book",
    colors: {
      "--color-surface": "#0f1117",
      "--color-surface-raised": "#1a1d27",
      "--color-surface-overlay": "#242836",
      "--color-border": "#2e3345",
      "--color-text": "#e8eaed",
      "--color-text-muted": "#9aa0b0",
      "--color-accent": "#7c6af7",
      "--color-accent-hover": "#9585ff",
      "--color-success": "#34d399",
      "--color-warning": "#fbbf24",
      "--color-danger": "#f87171",
    },
  },
  {
    id: "nord",
    label: "Nord",
    colors: {
      "--color-surface": "#2e3440",
      "--color-surface-raised": "#3b4252",
      "--color-surface-overlay": "#434c5e",
      "--color-border": "#4c566a",
      "--color-text": "#eceff4",
      "--color-text-muted": "#d8dee9",
      "--color-accent": "#88c0d0",
      "--color-accent-hover": "#8fbcbb",
      "--color-success": "#a3be8c",
      "--color-warning": "#ebcb8b",
      "--color-danger": "#bf616a",
    },
  },
  {
    id: "one-dark",
    label: "One Dark",
    colors: {
      "--color-surface": "#282c34",
      "--color-surface-raised": "#21252b",
      "--color-surface-overlay": "#2c313a",
      "--color-border": "#3e4451",
      "--color-text": "#abb2bf",
      "--color-text-muted": "#7f848e",
      "--color-accent": "#61afef",
      "--color-accent-hover": "#56b6c2",
      "--color-success": "#98c379",
      "--color-warning": "#e5c07b",
      "--color-danger": "#e06c75",
    },
  },
  {
    id: "catppuccin-mocha",
    label: "Catppuccin Mocha",
    colors: {
      "--color-surface": "#1e1e2e",
      "--color-surface-raised": "#181825",
      "--color-surface-overlay": "#313244",
      "--color-border": "#45475a",
      "--color-text": "#cdd6f4",
      "--color-text-muted": "#a6adc8",
      "--color-accent": "#cba6f7",
      "--color-accent-hover": "#b4befe",
      "--color-success": "#a6e3a1",
      "--color-warning": "#f9e2af",
      "--color-danger": "#f38ba8",
    },
  },
];

export function getTheme(id: string): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function applyTheme(themeId: string): void {
  const theme = getTheme(themeId);
  const root = document.documentElement;
  root.setAttribute("data-theme", theme.id);
  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(key, value);
  }
}
