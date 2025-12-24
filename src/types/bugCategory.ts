export interface BugCategory {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
}
