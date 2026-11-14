'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export default function Header({ title, role }) {
  const router = useRouter();
  const pathname = usePathname();

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/');
  }

  return (
    <header className="header" style={{ flexWrap: 'wrap', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Link href="/" className="brand">
          <span className="brand-badge">RŌX</span>
          <span>COACH</span>
          <span className="brand-hyrox">HYROX OS</span>
        </Link>
        {role && (
          <span className={`badge ${role === 'coach' ? 'badge-active' : 'badge-pending'}`} style={{ marginLeft: 6 }}>
            {role.toUpperCase()}
          </span>
        )}
      </div>

      {/* Navigation Links */}
      {role === 'athlete' && (
        <nav className="nav-links" style={{ overflowX: 'auto', padding: '4px 0' }}>
          <Link href="/athlete" className={`nav-link ${pathname === '/athlete' ? 'active' : ''}`}>
            Dashboard
          </Link>
          <Link href="/athlete/workouts/generate" className={`nav-link ${pathname?.includes('/workouts') ? 'active' : ''}`}>
            ⚡ Build Workout
          </Link>
          <Link href="/athlete/equipment" className={`nav-link ${pathname === '/athlete/equipment' ? 'active' : ''}`}>
            🎒 Equipment
          </Link>
          <Link href="/athlete/log" className={`nav-link ${pathname === '/athlete/log' ? 'active' : ''}`}>
            + Log Splits
          </Link>
        </nav>
      )}

      {role === 'coach' && (
        <nav className="nav-links">
          <Link href="/coach" className={`nav-link ${pathname === '/coach' ? 'active' : ''}`}>
            Command Centre
          </Link>
        </nav>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
        {title && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500, display: 'none' }}>{title}</span>}
        <button onClick={signOut} className="secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
          Sign out
        </button>
      </div>
    </header>
  );
}
