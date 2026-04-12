import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, X, Bug, Wrench, PlayCircle } from 'lucide-react';
import { UserFeedback } from '@/types/feedback';
import { AnalyzedFailureWithFeedback } from '@/types/feedback';
import { useBugCategories } from '@/hooks/useBugCategories';

type BulkAction = 'passed-locally' | 'bug' | 'manual-fix' | null;

interface BulkActionPanelProps {
  selectedCount: number;
  selectedFailures: AnalyzedFailureWithFeedback[];
  onBulkFeedback: (ids: string[], feedback: UserFeedback) => void;
  onConfirmAI: () => void;
  onClearSelection: () => void;
}

const passedLocallyReasons = [
  'Flaky test – passes on retry',
  'Environment issue – works locally',
  'Timing issue – test too fast',
  'Data dependency – stale test data',
  'Other',
];

const manualFixTypes = [
  'Test update needed',
  'Shared step update',
  'Test reassignment',
  'Environment fix',
  'Other',
];

export function BulkActionPanel({
  selectedCount,
  selectedFailures,
  onBulkFeedback,
  onConfirmAI,
  onClearSelection,
}: BulkActionPanelProps) {
  const [activeAction, setActiveAction] = useState<BulkAction>(null);
  const [selectedValue, setSelectedValue] = useState('');
  const [notes, setNotes] = useState('');
  const [bugLink, setBugLink] = useState('');
  const { categories, fetchCategoriesByType } = useBugCategories();
  const [bugCategories, setBugCategories] = useState<{ id: string; name: string }[]>([]);

  const openAction = async (action: BulkAction) => {
    setActiveAction(action);
    setSelectedValue('');
    setNotes('');
    setBugLink('');
    if (action === 'bug') {
      const cats = await fetchCategoriesByType('bug');
      setBugCategories(cats || []);
    }
  };

  const handleConfirm = () => {
    const ids = selectedFailures.map(f => f.id);

    if (activeAction === 'passed-locally') {
      const feedback: UserFeedback = {
        wasCorrect: true,
        passedLocally: true,
        passedLocallyReason: selectedValue,
        passedLocallyNotes: notes || undefined,
      };
      onBulkFeedback(ids, feedback);
    } else if (activeAction === 'bug') {
      const feedback: UserFeedback = {
        wasCorrect: false,
        userClassification: 'Potential bug',
        bugCategory: selectedValue,
        bugLink: bugLink || undefined,
      };
      onBulkFeedback(ids, feedback);
    } else if (activeAction === 'manual-fix') {
      const feedback: UserFeedback = {
        wasCorrect: false,
        requiredManualFix: true,
        manualFixType: selectedValue,
        manualFixNotes: notes || undefined,
      };
      onBulkFeedback(ids, feedback);
    }

    setActiveAction(null);
    onClearSelection();
  };

  if (selectedCount === 0) return null;

  return (
    <>
      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-lg">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground">
              {selectedCount} selected
            </span>
            <Button size="sm" variant="ghost" onClick={onClearSelection}>
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={onConfirmAI} className="text-confidence-high border-confidence-high/30">
              <CheckCircle className="h-4 w-4 mr-1" />
              Confirm AI ✓
            </Button>
            <Button size="sm" variant="outline" onClick={() => openAction('passed-locally')}>
              <PlayCircle className="h-4 w-4 mr-1" />
              Passed Locally
            </Button>
            <Button size="sm" variant="outline" onClick={() => openAction('bug')} className="text-bug border-bug/30">
              <Bug className="h-4 w-4 mr-1" />
              Bug
            </Button>
            <Button size="sm" variant="outline" onClick={() => openAction('manual-fix')}>
              <Wrench className="h-4 w-4 mr-1" />
              Manual Fix
            </Button>
          </div>
        </div>
      </div>

      {/* Action Dialog */}
      <Dialog open={activeAction !== null} onOpenChange={(open) => !open && setActiveAction(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {activeAction === 'passed-locally' && 'Passed Locally'}
              {activeAction === 'bug' && 'Report Bug'}
              {activeAction === 'manual-fix' && 'Manual Fix Required'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Applying to <span className="font-medium text-foreground">{selectedCount}</span> selected items
            </p>

            {activeAction === 'passed-locally' && (
              <Select value={selectedValue} onValueChange={setSelectedValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason..." />
                </SelectTrigger>
                <SelectContent>
                  {passedLocallyReasons.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {activeAction === 'bug' && (
              <>
                <Select value={selectedValue} onValueChange={setSelectedValue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select bug category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {bugCategories.map(c => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Bug link (optional)"
                  value={bugLink}
                  onChange={e => setBugLink(e.target.value)}
                />
              </>
            )}

            {activeAction === 'manual-fix' && (
              <Select value={selectedValue} onValueChange={setSelectedValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Select fix type..." />
                </SelectTrigger>
                <SelectContent>
                  {manualFixTypes.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {activeAction !== 'bug' && (
              <Textarea
                placeholder="Notes (optional)"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="min-h-[60px] resize-none"
              />
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveAction(null)}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={!selectedValue}>
              Apply to {selectedCount} items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
