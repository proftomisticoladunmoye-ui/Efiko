// Efiko — "Ask Efiko AI": type any topic, the AI Processing Engine (Stage 5)
// authors a Learning Capsule on demand. Calls the gateway's /lessons/generate.
import { useState } from 'react';

export default function AskEfiko({ onAsk, busy }) {
  const [topic, setTopic] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const t = topic.trim();
    if (t) onAsk(t);
  };

  return (
    <form className="ask" onSubmit={submit}>
      <label className="ask-label">✦ Ask Efiko AI — learn any topic</label>
      <div className="ask-row">
        <input
          className="ask-input"
          placeholder="e.g. Explain Bayes' theorem"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          disabled={busy}
        />
        <button className="ask-btn" type="submit" disabled={busy || !topic.trim()}>
          {busy ? 'Generating…' : 'Generate'}
        </button>
      </div>
    </form>
  );
}
