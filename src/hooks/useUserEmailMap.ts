import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Resolve auth user ids → emails via admin-users edge function (RLS-safe). */
export function useUserEmailMap(enabled: boolean) {
  const [emailByUserId, setEmailByUserId] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!enabled) {
      setEmailByUserId(new Map());
      return;
    }

    let cancelled = false;

    void (async () => {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'list' },
      });

      if (cancelled || error || data?.error) return;

      const map = new Map<string, string>();
      for (const u of (data?.users ?? []) as Array<{ id: string; email: string }>) {
        if (u.id && u.email) map.set(u.id, u.email);
      }
      setEmailByUserId(map);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return emailByUserId;
}

export function formatReportCreator(
  createdBy: string | null | undefined,
  emailByUserId: Map<string, string>,
): string {
  if (!createdBy) return '—';
  return emailByUserId.get(createdBy) ?? 'Unknown';
}
