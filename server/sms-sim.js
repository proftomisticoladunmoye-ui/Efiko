// Efiko — SMS simulator. Drives the core brain and prints what Efiko would send by
// SMS (plain text, 2G-friendly). No SMS gateway needed.  npm run sms:sim
import { loadEnv } from './env.js';
loadEnv();
import { createSession, handle } from './core/engine.js';
import { renderSms } from './channels/sms/render.js';

const SCRIPT = ['MENU', 'Explain GDP', 'QUIZ', 'C', 'A', 'B', 'SUMMARY'];

const C = { cyan: '\x1b[36m', green: '\x1b[32m', dim: '\x1b[2m', reset: '\x1b[0m' };
const session = createSession('+256700000000');

for (const text of SCRIPT) {
  console.log(`\n${C.cyan}SMS in  ▶ ${text}${C.reset}`);
  const result = await handle(session, text);
  const messages = renderSms(result);
  messages.forEach((m, i) => {
    const tag = messages.length > 1 ? ` (${i + 1}/${messages.length})` : '';
    console.log(`${C.green}SMS out ◀${tag}${C.reset} ${C.dim}[${m.length} chars]${C.reset}\n${m}`);
  });
}
console.log('');
