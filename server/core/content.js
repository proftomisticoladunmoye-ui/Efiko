// Efiko core — content loader.
// The WhatsApp channel reads the SAME catalog + capsule JSON as the PWA. One brain,
// many mouths (Stage 1 §1): teaching content has a single source of truth.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, '..', '..', 'public'); // server/core -> project root /public

let _catalog = null;
const _capsules = new Map();

export async function getCatalog() {
  if (!_catalog) {
    _catalog = JSON.parse(await readFile(join(PUBLIC, 'catalog.json'), 'utf8'));
  }
  return _catalog;
}

export async function getCapsule(id) {
  if (_capsules.has(id)) return _capsules.get(id);
  try {
    const capsule = JSON.parse(await readFile(join(PUBLIC, 'capsules', `${id}.json`), 'utf8'));
    _capsules.set(id, capsule);
    return capsule;
  } catch {
    return null;
  }
}

// Register an in-memory capsule (e.g. an AI-generated one) so getCapsule can return
// it and QUIZ / VOICE / FLASHCARDS work on it within the session.
export function registerCapsule(capsule) {
  _capsules.set(capsule.capsuleId, capsule);
  return capsule;
}
