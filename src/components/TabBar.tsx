import { NavLink } from 'react-router-dom';
import { haptic } from '../lib/haptics';

type Tab = { to: string; label: string; icon: string; end?: boolean };

const TABS: Tab[] = [
  { to: '/', label: 'Hoy', icon: '🏋️', end: true },
  { to: '/history', label: 'Historial', icon: '📅' },
  { to: '/settings', label: 'Ajustes', icon: '⚙️' },
];

export default function TabBar() {
  return (
    <nav className="tabbar" aria-label="Navegación principal">
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
