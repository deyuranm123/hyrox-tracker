'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export default function Header({ title, role }) {
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/');
  }

  return (
    <header className="header">
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

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <h1 style={{ display: 'none' }}>{title}</h1>
        {title && <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>{title}</span>}
        <button onClick={signOut} className="secondary" style={{ padding: '7px 14px', fontSize: '0.82rem' }}>
          Sign out
        </button>
      </div>
    </header>
  );
}
