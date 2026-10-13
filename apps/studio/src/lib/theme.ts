/*
 * Browser chrome colour (<meta name="theme-color">) per studio theme: the page
 * ground, --jvb-page in packages/ui/src/tokens.css (white, and #121212 in the
 * dark ramp). The brand-seal orange stays in the app icons only.
 *
 * Two writers keep the tag in step with data-theme on <html>: the no-flash
 * script in the root layout (before first paint) and ThemeToggle.
 */
export type StudioTheme = "light" | "dark";

export const THEME_COLOR: Record<StudioTheme, string> = {
  light: "#ffffff",
  dark: "#121212",
};

/** Points the theme-color meta at the given theme, creating the tag if absent. */
export function setThemeColorMeta(theme: StudioTheme): void {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = THEME_COLOR[theme];
}
