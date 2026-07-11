import { useEffect, useState } from 'react';
import { supabase } from "./utils/supabase"; // adjust to your actual client path

// Fetches the signed-in user's profile (id, full_name, role) once and
// exposes simple booleans so pages/components can gate UI by role.
export function useCurrentProfile() {
  const [profile, setProfile] = useState(null); 
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (isMounted) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', user.id)
        .single();

      if (isMounted) {
        setProfile(data ?? null);
        setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  return {
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    isTechnician: profile?.role === 'technician',
  };
}
