// EFIKO — instant streamed answer. The tutor's explanation appears token-by-token in ~1–2s;
// the full lesson (whiteboard, quiz, flashcards, offline save) is generated on demand.
export default function AskAnswer({ answer, onFullLesson, onBack, busy }) {
  if (!answer) return null;
  const paras = (answer.text || '').split(/\n{2,}/).filter(Boolean);
  return (
    <div className="ask-answer">
      <button className="back" onClick={onBack}>← Back</button>
      <h2 className="ask-answer-q">{answer.topic}</h2>
      <div className="ask-answer-body">
        {paras.length === 0 && answer.streaming && <p className="ask-answer-thinking">✨ Efiko is thinking…</p>}
        {paras.map((p, i) => (
          <p key={i}>{p}{answer.streaming && i === paras.length - 1 ? <span className="ask-answer-cursor" /> : null}</p>
        ))}
      </div>
      {answer.err && <p className="error">Sorry — {answer.err}</p>}
      {!answer.streaming && !answer.err && (
        <div className="ask-answer-actions">
          <button className="course-open" disabled={busy} onClick={() => onFullLesson(answer.topic)}>
            {busy ? 'Building your lesson…' : '📚 Turn into a full lesson — whiteboard, quiz & flashcards'}
          </button>
          <button className="course-share-btn" onClick={onBack}>Ask something else</button>
        </div>
      )}
    </div>
  );
}
