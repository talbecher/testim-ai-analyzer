import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Settings as SettingsIcon, ArrowLeft, Plus, Trash2, GripVertical, Tag, TestTube, Wrench, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BugCategory, CategoryType } from '@/types/bugCategory';
import { ThemeToggle } from '@/components/ThemeToggle';
import { toast } from 'sonner';
import { getVersionInfo } from '@/version';
import { ChangelogDialog } from '@/components/ChangelogDialog';

interface CategorySectionProps {
  type: CategoryType;
  title: string;
  description: string;
  icon: React.ReactNode;
  categories: BugCategory[];
  isLoading: boolean;
  onAdd: (name: string, type: CategoryType) => Promise<void>;
  onUpdate: (id: string, name: string) => Promise<void>;
  onDelete: (id: string, name: string) => Promise<void>;
  onToggle: (id: string, isActive: boolean) => Promise<void>;
}

function CategorySection({ 
  type, 
  title, 
  description, 
  icon, 
  categories, 
  isLoading, 
  onAdd, 
  onUpdate, 
  onDelete, 
  onToggle 
}: CategorySectionProps) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await onAdd(newName.trim(), type);
      setNewName('');
      toast.success('Category added');
    } catch (error) {
      toast.error('Failed to add category');
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editingName.trim()) return;
    try {
      await onUpdate(id, editingName.trim());
      setEditingId(null);
      setEditingName('');
      toast.success('Category updated');
    } catch (error) {
      toast.error('Failed to update category');
    }
  };

  const filteredCategories = categories.filter(c => c.category_type === type);

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new category */}
        <div className="flex gap-2">
          <Input
            placeholder="New category name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="flex-1"
          />
          <Button onClick={handleAdd} disabled={!newName.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>

        {/* Categories list */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-2">
            {filteredCategories.map((category) => (
              <div
                key={category.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card/50 hover:bg-card/80 transition-colors"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                
                {editingId === category.id ? (
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdate(category.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onBlur={() => handleUpdate(category.id)}
                    className="flex-1 h-8"
                    autoFocus
                  />
                ) : (
                  <span
                    className="flex-1 cursor-pointer hover:text-primary transition-colors"
                    onClick={() => {
                      setEditingId(category.id);
                      setEditingName(category.name);
                    }}
                  >
                    {category.name}
                  </span>
                )}

                <div className="flex items-center gap-2">
                  <Switch
                    checked={category.is_active}
                    onCheckedChange={() => onToggle(category.id, category.is_active)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(category.id, category.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {filteredCategories.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No categories yet. Add your first category above.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const Settings = () => {
  const [categories, setCategories] = useState<BugCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAllCategories = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('bug_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (!error && data) {
      setCategories(data as BugCategory[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchAllCategories();
  }, [fetchAllCategories]);

  const handleAdd = async (name: string, type: CategoryType) => {
    const maxOrder = Math.max(...categories.filter(c => c.category_type === type).map(c => c.sort_order), 0);
    
    const { data, error } = await supabase
      .from('bug_categories')
      .insert([{ name, category_type: type, sort_order: maxOrder + 1, is_active: true }])
      .select()
      .single();

    if (error) throw new Error(error.message);
    setCategories(prev => [...prev, data as BugCategory]);
  };

  const handleUpdate = async (id: string, name: string) => {
    const { error } = await supabase
      .from('bug_categories')
      .update({ name })
      .eq('id', id);

    if (error) throw new Error(error.message);
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name } : c));
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    
    const { error } = await supabase
      .from('bug_categories')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
    setCategories(prev => prev.filter(c => c.id !== id));
    toast.success('Category deleted');
  };

  const handleToggle = async (id: string, currentState: boolean) => {
    const { error } = await supabase
      .from('bug_categories')
      .update({ is_active: !currentState })
      .eq('id', id);

    if (error) throw new Error(error.message);
    setCategories(prev => prev.map(c => c.id === id ? { ...c, is_active: !currentState } : c));
    toast.success(currentState ? 'Category disabled' : 'Category enabled');
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="icon">
              <Link to="/">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <SettingsIcon className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            </div>
          </div>
          <ThemeToggle />
        </header>

        {/* Bug Categories */}
        <CategorySection
          type="bug"
          title="Bug Categories"
          description='Categories for "Yes, it was a bug" - classify the type of bug found.'
          icon={<Tag className="h-5 w-5 text-destructive" />}
          categories={categories}
          isLoading={isLoading}
          onAdd={handleAdd}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onToggle={handleToggle}
        />

        {/* Passed Locally Reasons */}
        <CategorySection
          type="passed_locally"
          title="Passed Locally Reasons"
          description='Reasons for "No, passed locally" - explain why the test passed in local verification.'
          icon={<TestTube className="h-5 w-5 text-confidence-high" />}
          categories={categories}
          isLoading={isLoading}
          onAdd={handleAdd}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onToggle={handleToggle}
        />

        {/* Manual Fix Types */}
        <CategorySection
          type="manual_fix"
          title="Manual Fix Types"
          description='Types for "Required manual fix" - categorize manual interventions needed.'
          icon={<Wrench className="h-5 w-5 text-amber-500" />}
          categories={categories}
          isLoading={isLoading}
          onAdd={handleAdd}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onToggle={handleToggle}
        />

        {/* About / Version Info */}
        <Card className="border-border/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              About This App
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Version</span>
              <span className="font-mono font-medium">{getVersionInfo().version}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last Updated</span>
              <span className="text-sm">{getVersionInfo().formattedDate}</span>
            </div>
            <ChangelogDialog>
              <Button variant="outline" className="w-full mt-2">
                View Changelog
              </Button>
            </ChangelogDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
