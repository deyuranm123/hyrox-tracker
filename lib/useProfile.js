'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './supabase';

// Loads the signed-in user's profile. If nobody is signed in, sends them to the login page.
// If the role does not match the page, sends them to their own home page.
export function useProfile(requiredRole) {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) {
        router.replace('/');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, name, email')
        .eq('id', user.id)
        .single();

      if (cancelled) return;
      if (error || !data) {
        setLoading(false);
        return;
      }

      if (requiredRole && data.role !== requiredRole) {
        router.replace(data.role === 'coach' ? '/coach' : '/athlete');
        return;
      }

      setProfile(data);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [router, requiredRole]);

  return { profile, loading };
}
