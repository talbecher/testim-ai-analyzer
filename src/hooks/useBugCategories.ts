import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BugCategory } from '@/types/bugCategory';

export function useBugCategories() {
  const [categories, setCategories] = useState<BugCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    const { data, error: fetchError } = await supabase
      .from('bug_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setCategories(data || []);
    }
    setIsLoading(false);
  }, []);

  const fetchAllCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    const { data, error: fetchError } = await supabase
      .from('bug_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setCategories(data || []);
    }
    setIsLoading(false);
  }, []);

  const addCategory = useCallback(async (name: string, description?: string) => {
    const maxOrder = Math.max(...categories.map(c => c.sort_order), 0);
    
    const { data, error: insertError } = await supabase
      .from('bug_categories')
      .insert([{ name, description, sort_order: maxOrder + 1, is_active: true }])
      .select()
      .single();

    if (insertError) {
      throw new Error(insertError.message);
    }
    
    setCategories(prev => [...prev, data]);
    return data;
  }, [categories]);

  const updateCategory = useCallback(async (id: string, updates: Partial<BugCategory>) => {
    const { error: updateError } = await supabase
      .from('bug_categories')
      .update(updates)
      .eq('id', id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    const { error: deleteError } = await supabase
      .from('bug_categories')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    setCategories(prev => prev.filter(c => c.id !== id));
  }, []);

  const toggleActive = useCallback(async (id: string, isActive: boolean) => {
    await updateCategory(id, { is_active: isActive });
  }, [updateCategory]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return {
    categories,
    isLoading,
    error,
    fetchCategories,
    fetchAllCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    toggleActive
  };
}
