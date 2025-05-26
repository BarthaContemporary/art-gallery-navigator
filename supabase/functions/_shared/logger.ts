
// Basic logger for Supabase Edge Functions
// In a real setup, you might use a more sophisticated logging library or service

export const logger = {
  log: (...args: any[]) => {
    console.log("[LOG]", ...args);
  },
  info: (...args: any[]) => {
    console.info("[INFO]", ...args);
  },
  warn: (...args: any[]) => {
    console.warn("[WARN]", ...args);
  },
  error: (...args: any[]) => {
    console.error("[ERROR]", ...args);
  },
  debug: (...args: any[]) => {
    // Supabase logs console.debug by default in local dev
    console.debug("[DEBUG]", ...args);
  },
};
