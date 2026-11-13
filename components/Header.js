'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export default function Header({ title }) {
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/');
  }

  return (
    <header className="header">
      <Link href="/" className="brand">Hyrox Tracker</Link>
      <h1>{title}</h1>
      <button onClick={signOut} className="secondary">Sign out</button>
    </header>
  );
}
