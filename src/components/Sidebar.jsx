// EFIKO 2.0 — left navigation rail (R1: App Shell & IA). Learner-facing sections; the
// teacher/institution tools live behind "Teach", shown only to accounts that can teach
// (creators, institutions, lecturers). See docs/EFIKO-V2-REORGANIZATION.md.
import { can } from '../rbac.js';

const NAV = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'learn', label: 'Learn', icon: '✦' },
  { id: 'thinkspace', label: 'ThinkSpace', icon: '🧠' },
  { id: 'originals', label: 'Originals', icon: '⭐' },
  { id: 'courses', label: 'Courses', icon: '📚' },
  { id: 'whiteboard', label: 'Whiteboard', icon: '🎨' },
  { id: 'assessments', label: 'Assessments', icon: '📝' },
  { id: 'planner', label: 'Study Planner', icon: '🗓️' },
  { id: 'career', label: 'Career', icon: '🚀' },
  { id: 'community', label: 'Community', icon: '👥' },
  { id: 'market', label: 'Marketplace', icon: '🛒' },
  { id: 'certificates', label: 'Certificates', icon: '🎓' },
  { id: 'library', label: 'Library', icon: '📥' }
];

export default function Sidebar({ active, onSelect, onTeach, user }) {
  const canTeach = can(user, 'teach');
  const teachLabel = can(user, 'manage_institution') ? 'Institution' : 'Teach';
  return (
    <nav className="sidebar" aria-label="Main navigation">
      <ul className="sidebar-nav">
        {NAV.map((n) => (
          <li key={n.id}>
            <button className={`nav-item ${active === n.id ? 'on' : ''}`} onClick={() => onSelect(n.id)} aria-current={active === n.id ? 'page' : undefined}>
              <span className="nav-icon" aria-hidden="true">{n.icon}</span>
              <span className="nav-label">{n.label}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="sidebar-foot">
        {canTeach && (
          <button className={`nav-item ${active === 'teach' ? 'on' : ''}`} onClick={onTeach}>
            <span className="nav-icon" aria-hidden="true">🧑‍🏫</span><span className="nav-label">{teachLabel}</span>
          </button>
        )}
        <button className={`nav-item ${active === 'settings' ? 'on' : ''}`} onClick={() => onSelect('settings')}>
          <span className="nav-icon" aria-hidden="true">⚙️</span><span className="nav-label">Settings</span>
        </button>
      </div>
    </nav>
  );
}
