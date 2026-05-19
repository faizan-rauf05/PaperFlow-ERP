export const THEME_STORAGE_KEY = "theme";
export const THEME_COOKIE = "theme";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Class names applied to <html> for SSR (no inline scripts). */
export function getHtmlThemeClass(theme) {
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  return "";
}

export function setThemeCookie(theme) {
  if (typeof document === "undefined") return;
  document.cookie = `${THEME_COOKIE}=${encodeURIComponent(theme)};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`;
}
