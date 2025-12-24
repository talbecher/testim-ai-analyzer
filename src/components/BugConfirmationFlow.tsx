import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, X, Link as LinkIcon, Bug, TestTube } from 'lucide-react';
import { useBugCategories } from '@/hooks/useBugCategories';

interface BugConfirmationFlowProps {
  onConfirmBug: (category: string, bugLink?: string) => void;
  onPassedLocally: () => void;
  onCancel: () => void;
}

export function BugConfirmationFlow({ onConfirmBug, onPassedLocally, onCancel }: BugConfirmationFlowProps) {
  const { categories, isLoading } = useBugCategories();
  const [step, setStep] = useState<'question' | 'category'>('question');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [bugLink, setBugLink] = useState('');

  const handleYesBug = () => {
    setStep('category');
  };

  const handleConfirmCategory = () => {
    if (selectedCategory) {
      onConfirmBug(selectedCategory, bugLink || undefined);
    }
  };

  if (step === 'question') {
    return (
      <div className="space-y-3 animate-fade-in">
        <div className="text-sm font-medium text-foreground">Was there actually a bug?</div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="h-8 text-xs bg-bug hover:bg-bug/90 text-bug-foreground"
            onClick={handleYesBug}
          >
            <Bug className="h-3 w-3 mr-1" />
            Yes, it was a bug
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs bg-confidence-high/10 hover:bg-confidence-high/20 text-confidence-high border-confidence-high/30"
            onClick={onPassedLocally}
          >
            <TestTube className="h-3 w-3 mr-1" />
            No, passed locally
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="text-sm font-medium text-foreground">Select bug category:</div>
      <div className="grid gap-2">
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder={isLoading ? "Loading..." : "Select category..."} />
          </SelectTrigger>
          <SelectContent>
            {categories.map(cat => (
              <SelectItem key={cat.id} value={cat.name} className="text-xs">
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <LinkIcon className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Bug link (optional)"
            value={bugLink}
            onChange={(e) => setBugLink(e.target.value)}
            className="h-8 text-xs flex-1"
          />
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={handleConfirmCategory}
            disabled={!selectedCategory}
          >
            <Check className="h-3 w-3 mr-1" />
            Confirm
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setStep('question')}
          >
            Back
          </Button>
        </div>
      </div>
    </div>
  );
}
