export type CategoryType = 'bug' | 'passed_locally' | 'manual_fix';

export interface BugCategory {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
  category_type: CategoryType;
  created_at?: string;
}
