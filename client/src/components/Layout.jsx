import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Brand from './Brand.jsx';

const adminLinks = [
  { to: '/admin',     label: 'Dashboard',   icon: '🏠' },
  { to: '/schedule',  label: 'Schedule',    icon: '🗓️' },
  { to: '/employees', label: 'Employees',   icon: '👥' },
  { to: '/requests',  label: 'Requests',    icon: '🔁' },
  { to: '/reports',   label: 'Reports',     icon: '📊' },
];

const employeeLinks = [
  { to: '/me',           label: 'Today',         icon: '🌶️' },
  { to: '/schedule',     label: 'My Week',       icon: '🗓️' },
  { to: '/availability', label: 'Availability',  icon: '✅' },
  { to: '/requests',     label: 'Requests',      icon: '🔁' },
  { to: '/reports',      label: 'My Hours',      icon: '📊' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = user?.role === 'admin' ? adminLinks : employeeLinks;

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex md:flex-col w-72 bg-charcoal-800 border-r border-white/5 p-6 gap-2 sticky top-0 h-screen">
        <Brand />
        <div className="mt-6 text-xs uppercase tracking-widest text-cream/40 px-2">
          {user?.role === 'admin' ? 'Manager' : 'Staff'}
        </div>
        <nav className="flex flex-col gap-1 mt-2">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="text-lg">{l.icon}</span>
              <span>{l.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto pt-6 border-t border-white/10">
          <div className="text-sm text-cream/80 px-2">
            <div className="font-semibold">{user?.fullName || user?.email}</div>
            <div className="text-cream/50 text-xs">{user?.email}</div>
          </div>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="mt-4 btn-ghost w-full"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Top bar — mobile */}
      <header className="md:hidden flex items-center justify-between p-4 bg-charcoal-800 border-b border-white/5">
        <Brand compact />
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="text-cream/70 text-sm px-3 py-1 rounded-full border border-cream/20"
        >Sign out</button>
      </header>

      {/* Main */}
      <main className="flex-1 px-5 md:px-10 py-6 md:py-10 pb-28 md:pb-10">
        <Outlet />
      </main>

      {/* Bottom nav — mobile */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-charcoal-800 border-t border-white/10 px-2 py-2 z-30">
        <div className="grid grid-cols-5 gap-1">
          {links.slice(0, 5).map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({isActive}) =>
                `flex flex-col items-center justify-center py-2 rounded-2xl text-[11px] gap-0.5
                 ${isActive ? 'bg-accent-red text-cream' : 'text-cream/70'}`
              }
            >
              <span className="text-lg leading-none">{l.icon}</span>
              <span className="leading-tight">{l.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
