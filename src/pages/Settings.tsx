import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Settings as SettingsIcon, ArrowLeft, Plus, Trash2, GripVertical, Tag } from 'lucide-react';
import { useBugCategories } from '@/hooks/useBugCategories';
import { ThemeToggle } from '@/components/ThemeToggle';
import { toast } from 'sonner';

const Settings = () => {
  const { 
    categories, 
    isLoading, 
    fetchAllCategories,
    addCategory, 
    updateCategory, 
    deleteCategory,
    toggleActive 
  } = useBugCategories();
  
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Fetch all categories (including inactive) on mount
  useEffect(() => {
    fetchAllCategories();
  }, [fetchAllCategories]);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    
    try {
      await addCategory(newCategoryName.trim());
      setNewCategoryName('');
      toast.success('Category added');
      fetchAllCategories();
    } catch (error) {
      toast.error('Failed to add category');
    }
  };

  const handleUpdateCategory = async (id: string) => {
    if (!editingName.trim()) return;
    
    try {
      await updateCategory(id, { name: editingName.trim() });
      setEditingId(null);
      setEditingName('');
      toast.success('Category updated');
    } catch (error) {
      toast.error('Failed to update category');
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    
    try {
      await deleteCategory(id);
      toast.success('Category deleted');
    } catch (error) {
      toast.error('Failed to delete category');
    }
  };

  const handleToggleActive = async (id: string, currentState: boolean) => {
    try {
      await toggleActive(id, !currentState);
      toast.success(currentState ? 'Category disabled' : 'Category enabled');
    } catch (error) {
      toast.error('Failed to update category');
    }
  };

  const startEditing = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
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

        {/* Bug Categories Management */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              Bug Categories
            </CardTitle>
            <CardDescription>
              Manage the bug categories available when reviewing AI analysis.
              These categories help track what type of bugs are found.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add new category */}
            <div className="flex gap-2">
              <Input
                placeholder="New category name..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                className="flex-1"
              />
              <Button onClick={handleAddCategory} disabled={!newCategoryName.trim()}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            {/* Categories list */}
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (
              <div className="space-y-2">
                {categories.map((category) => (
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
                          if (e.key === 'Enter') handleUpdateCategory(category.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        onBlur={() => handleUpdateCategory(category.id)}
                        className="flex-1 h-8"
                        autoFocus
                      />
                    ) : (
                      <span
                        className="flex-1 cursor-pointer hover:text-primary transition-colors"
                        onClick={() => startEditing(category.id, category.name)}
                      >
                        {category.name}
                      </span>
                    )}

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={category.is_active}
                        onCheckedChange={() => handleToggleActive(category.id, category.is_active)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteCategory(category.id, category.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {categories.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No categories yet. Add your first category above.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
