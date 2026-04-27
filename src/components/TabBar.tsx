import { NavLink } from 'react-router-dom';
import { haptic } from '../lib/haptics';

type Tab = { to: string; label: string; icon: string; end?: boolean };

const TABS: Tab[] = [
  { to: '/', label: 'HOY', icon: '■', end: true },
  { to: '/plan', label: 'PLAN', icon: '▦' },
  { to: '/history', label: 'LOG', icon: '≡' },
  { to: '/settings', label: 'CFG', icon: '◉' },
];

export default function TabBar() {
  return (
    <nav className="tabbar" aria-label="Navegación">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          onClick={() => haptic('light')}
          className={({ isActive }) => `tab${isActive ? ' tab-active' : ''}`}
        >
          <span className="tab-icon" aria-hidden>{tab.icon}</span>
          <span className="tab-label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
