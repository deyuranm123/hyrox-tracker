'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './supabase';

/**
 * useProfile - Hardened authentication & role gatekeeper hook.
 *
 * Automatically fetches the active user's profile and validates their role.
 * If unauthenticated or profile retrieval fails, sets error state and redirects to '/'.
 * Stabilizes requiredRole across renders to avoid unnecessary refetch cycles.
 */
export function useProfile(requiredRole) {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Stabilize requiredRole reference so string literals do not trigger refetches
  const requiredRoleRef = useRef(requiredRole);
  requiredRoleRef.current = requiredRole;

  useEffect(() => {
    let isMounted = true;

    async function fetchProfile() {
      try {
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) throw sessionErr;

        const user = sessionData?.session?.user;
        if (!user) {
          if (isMounted) {
            setLoading(false);
            router.replace('/');
          }
          return;
        }

        const { data, error: profileErr } = await supabase
          .from('profiles')
          .select('id, role, full_name, email')
          .eq('id', user.id)
          .single();

        if (!isMounted) return;

        if (profileErr || !data) {
          const errMsg = profileErr?.message || 'Profile record not found for this authenticated user.';
          setError(errMsg);
          setLoading(false);
          router.replace('/');
          return;
        }

        const expectedRole = requiredRoleRef.current;
        if (expectedRole && data.role !== expectedRole) {
          router.replace(data.role === 'coach' ? '/coach' : '/athlete');
          return;
        }

        setProfile(data);
        setError(null);
        setLoading(false);
      } catch (err) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Authentication verification error';
        setError(msg);
        setLoading(false);
        router.replace('/');
      }
    }

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return { profile, loading, error };
}
