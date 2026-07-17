import React, { Suspense, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { FlaskConical, Home, Swords, Trophy, GraduationCap, Settings } from 'lucide-react';
import { useSettingsStore } from '../stores/settings-store';

const NAV = [
  { to: '/', label: 'Dashboard', icon: Home, end: true },
  { to: '/lab', label: 'Lab', icon: FlaskConical, end: false },
  { to: '/arena', label: 'Arena', icon: Swords, end: false },
  { to: '/gallery', label: 'Gallery', icon: Trophy, end: false },
  { to: '/learn', label: 'Learn', icon: GraduationCap, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
];

export function App(): React.ReactElement {
  const load = useSettingsStore((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-graphite-950">
      <header className="z-20 flex items-center gap-3 border-b border-white/5 bg-graphite-900/80 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-specimen/15 text-lg" aria-hidden>
            🧬
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight text-slate-100">
              Creature Evolution Lab
            </div>
            <div className="text-[10px] text-slate-500">Design · Evolve · Discover</div>
          </div>
        </div>
        <nav className="ml-4 flex items-center gap-1" aria-label="Primary">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-specimen/15 text-specimen'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`
              }
            >
              <Icon size={15} aria-hidden />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="min-h-0 flex-1 overflow-auto">
        <Suspense
          fallback={
            <div className="grid h-full place-items-center text-sm text-slate-500">Loading…</div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
