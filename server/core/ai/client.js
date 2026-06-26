// Efiko — AI Processing Engine: Anthropic client (Stage 5).
// The client reads ANTHROPIC_API_KEY from the environment (never hard-coded).
// With no key, the engine stays in graceful fallback — nothing crashes.
import Anthropic from '@anthropic-ai/sdk';

export const AUTHOR_MODEL = process.env.EFIKO_AUTHOR_MODEL || 'claude-opus-4-8';
export const FAST_MODEL = process.env.EFIKO_FAST_MODEL || 'claude-haiku-4-5';

let _client = null;

// Tolerate stray whitespace from hand-edited .env files.
function apiKey() {
  return (process.env.ANTHROPIC_API_KEY || '').trim();
}

export function isConfigured() {
  return Boolean(apiKey());
}

export function getClient() {
  if (!isConfigured()) return null;
  if (!_client) _client = new Anthropic({ apiKey: apiKey() });
  return _client;
}
