// Efiko — tiny key/value store. Postgres (Neon) when DATABASE_URL is set — durable,
// survives redeploys — else local JSON files (dev / pre-DB). One JSONB table keyed by
// (collection, id) holds every document (institutions, published lessons, …).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', 'data');
const URL_ = (process.env.DATABASE_URL || '').trim();

export function dbConfigured() {
  return Boolean(URL_);
}

// --- Postgres backend (lazy: only loaded when DATABASE_URL is set) ---
let _pool = null;
let _ready = null;
async function pool() {
  if (!URL_) return null;
  if (!_pool) {
    const pg = await import('pg');
    const Pool = pg.default?.Pool || pg.Pool;
    _pool = new Pool({
      connectionString: URL_,
      ssl: URL_.includes('localhost') ? false : { rejectUnauthorized: false }
    });
    _ready = _pool.query(
      'CREATE TABLE IF NOT EXISTS efiko_kv (collection text, id text, data jsonb, updated_at timestamptz default now(), primary key (collection, id))'
    );
  }
  await _ready;
  return _pool;
}

// --- File backend (fallback) ---
const _maps = new Map();
async function fileMap(coll) {
  if (_maps.has(coll)) return _maps.get(coll);
  const m = new Map();
  try {
    const parsed = JSON.parse(await readFile(join(DATA, `${coll}.json`), 'utf8'));
    if (Array.isArray(parsed)) {
      for (const v of parsed) m.set(v.capsuleId || v.orgId || v.id, v); // tolerate old array files
    } else {
      for (const [k, v] of Object.entries(parsed)) m.set(k, v);
    }
  } catch { /* none yet */ }
  _maps.set(coll, m);
  return m;
}
async function filePersist(coll) {
  await mkdir(DATA, { recursive: true });
  await writeFile(join(DATA, `${coll}.json`), JSON.stringify(Object.fromEntries(_maps.get(coll)), null, 2));
}

export async function kvGet(coll, id) {
  const p = await pool();
  if (p) {
    const r = await p.query('SELECT data FROM efiko_kv WHERE collection=$1 AND id=$2', [coll, id]);
    return r.rows[0]?.data ?? null;
  }
  return (await fileMap(coll)).get(id) ?? null;
}

export async function kvPut(coll, id, data) {
  const p = await pool();
  if (p) {
    await p.query(
      'INSERT INTO efiko_kv (collection,id,data,updated_at) VALUES ($1,$2,$3,now()) ON CONFLICT (collection,id) DO UPDATE SET data=$3, updated_at=now()',
      [coll, id, data]
    );
    return data;
  }
  const m = await fileMap(coll);
  m.set(id, data);
  await filePersist(coll);
  return data;
}

export async function kvAll(coll) {
  const p = await pool();
  if (p) {
    const r = await p.query('SELECT data FROM efiko_kv WHERE collection=$1', [coll]);
    return r.rows.map((x) => x.data);
  }
  return [...(await fileMap(coll)).values()];
}

export async function kvDel(coll, id) {
  const p = await pool();
  if (p) {
    await p.query('DELETE FROM efiko_kv WHERE collection=$1 AND id=$2', [coll, id]);
    return;
  }
  const m = await fileMap(coll);
  m.delete(id);
  await filePersist(coll);
}
