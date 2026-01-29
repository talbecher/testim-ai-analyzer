import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RegressionBucketRow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export function useRegressionBuckets(activeOnly = true) {
  const [buckets, setBuckets] = useState<RegressionBucketRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    let query = supabase
      .from('regression_buckets')
      .select('*')
      .order('sort_order', { ascending: true });
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    const { data, error: err } = await query;
    if (err) {
      setError(err.message);
      setBuckets([]);
    } else {
      setBuckets((data as RegressionBucketRow[]) || []);
    }
    setIsLoading(false);
  }, [activeOnly]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const bucketNames = buckets.map((b) => b.name);

  return {
    buckets,
    bucketNames,
    isLoading,
    error,
    refetch,
  };
}
