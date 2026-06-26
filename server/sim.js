// Efiko — WhatsApp simulator. Drives the core brain through the master-prompt
// scenarios and prints what Efiko would send on WhatsApp. No Meta credentials needed.
//   npm run wa:sim
import { loadEnv } from './env.js';
loadEnv();
import { createSession, handle } from './core/engine.js';
import { renderResult } from './channels/whatsapp/render.js';

const SCRIPT = [
  'MENU',
  'KIU PSY720 IRT',
  'QUIZ',
  'A',
  'A',
  'B',
  'FLASHCARDS'
];

const C = { dim: '\x1b[2m', cyan: '\x1b[36m', green: '\x1b[32m', reset: '\x1b[0m' };

const session = createSession('+256700000000');

for (const text of SCRIPT) {
  console.log(`\n${C.cyan}Student ▶ ${text}${C.reset}`);
  const result = await handle(session, text);
  const messages = renderResult(result);
  for (const m of messages) {
    if (m.type === 'text') {
      console.log(`${C.green}Efiko ◀${C.reset}\n${m.body}`);
    } else if (m.type === 'image') {
      console.log(`${C.green}Efiko ◀${C.reset} ${C.dim}[image] ${m.caption || ''} (${m.link})${C.reset}`);
    } else {
      console.log(`${C.green}Efiko ◀${C.reset} ${C.dim}[${m.type}]${C.reset}`);
    }
  }
}
console.log('');
