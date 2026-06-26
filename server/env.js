// Efiko — load .env into process.env (Node 20.6+ / 24 has process.loadEnvFile).
// Zero-dependency: no dotenv. Safe no-op if the file is missing.
export function loadEnv(path = '.env') {
  try {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(path);
    }
  } catch {
    // .env absent or unreadable — fine, we fall back to real env vars / mock mode.
  }
}
