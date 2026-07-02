// EFIKO 2.0 — "My Work" (R4). In the Library: the learner's ThinkSpace discussions and the
// resources they've generated, each exportable to Markdown / Word / PDF.
import { useEffect, useState } from 'react';
import { listDiscussions, getDiscussion } from '../thinkspace.js';
import { exportMarkdown, exportWord, printPdf } from '../exportEngine.js';

export default function MyWork({ signedIn }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (signedIn) listDiscussions().then(setItems);
    else setItems([]);
  }, [signedIn]);

  if (!signedIn || items.length === 0) return null;

  async function doExport(id, fn) {
    const d = await getDiscussion(id);
    if (d) fn(d);
  }

  return (
    <section className="mywork-card">
      <h3>🗂️ My Work</h3>
      <p className="lib-sub">Your ThinkSpace discussions and generated notes, quizzes and flashcards. Export any to Markdown, Word or PDF.</p>
      <div className="mywork-list">
        {items.map((d) => (
          <div key={d.id} className="mywork-row">
            <span className="mywork-title">{d.title}</span>
            <span className="mywork-actions">
              <button onClick={() => doExport(d.id, exportMarkdown)} title="Markdown">MD</button>
              <button onClick={() => doExport(d.id, exportWord)} title="Word">Word</button>
              <button onClick={() => doExport(d.id, printPdf)} title="Print / Save as PDF">PDF</button>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
