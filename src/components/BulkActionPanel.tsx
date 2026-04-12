import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, X, Bug, PlayCircle, Wrench, ListChecks } from 'lucide-react';
import { UserFeedback } from '@/types/feedback';
import { AnalyzedFailureWithFeedback } from '@/types/feedback';
import { useBugCategories } from '@/hooks/useBugCategories';

type DialogStep = 'question' | 'category';
type FlowType = 'bug' | 'passed-locally' | 'manual-fix';

interface BulkActionPanelProps {
  selectedCount: number;
  selectedFailures: AnalyzedFailureWithFeedback[];
  onBulkFeedback: (ids: string[], feedback: UserFeedback) => void;
  onConfirmAI: () => void;
  onClearSelection: () => void;
}

export function BulkActionPanel({
  selectedCount,
  selectedFailures,
  onBulkFeedback,
  onConfirmAI,
  onClearSelection,
}: BulkActionPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<DialogStep>('question');
  const [flowType, setFlowType] = useState<FlowType | null>(null);
  const [selectedValue, setSelectedValue] = useState('');
  const [notes, setNotes] = useState('');
  const [bugLink, setBugLink] = useState('');
  const [cachedCategories, setCachedCategories] = useState<Record<string, { id: string; name: string }[]>>({});
  const [loadingCategories, setLoadingCategories] = useState(false);

  const { fetchCategoriesByType } = useBugCategories();

  const getCategoryType = (flow: FlowType) => {
    if (flow === 'bug') return 'bug' as const;
    if (flow === 'passed-locally') return 'passed_locally' as const;
    return 'manual_fix' as const;
  };

  const loadCategories = useCallback(async (flow: FlowType) => {
    const type = getCategoryType(flow);
    if (cachedCategories[type]) return;
    setLoadingCategories(true);
    try {
      const cats = await fetchCategoriesByType(type);
      setCachedCategories(prev => ({ ...prev, [type]: cats || [] }));
    } catch (e) {
      console.error('Failed to load categories:', e);
    }
    setLoadingCategories(false);
  }, [cachedCategories, fetchCategoriesByType]);

  const openDialog = () => {
    setDialogOpen(true);
    setStep('question');
    setFlowType(null);
    setSelectedValue('');
    setNotes('');
    setBugLink('');
  };

  const handleFlowChoice = async (flow: FlowType) => {
    setFlowType(flow);
    setStep('category');
    await loadCategories(flow);
  };

  const currentCategories = flowType ? cachedCategories[getCategoryType(flowType)] || [] : [];

  const handleConfirm = () => {
    const ids = selectedFailures.map(f => f.id);

    if (flowType === 'passed-locally') {
      const feedback: UserFeedback = {
        wasCorrect: true,
        passedLocally: true,
        passedLocallyReason: selectedValue,
        passedLocallyNotes: notes || undefined,
      };
      onBulkFeedback(ids, feedback);
    } else if (flowType === 'bug') {
      const feedback: UserFeedback = {
        wasCorrect: false,
        userClassification: 'Potential bug',
        bugCategory: selectedValue,
        bugLink: bugLink || undefined,
        notes: notes || undefined,
      };
      onBulkFeedback(ids, feedback);
    } else if (flowType === 'manual-fix') {
      const feedback: UserFeedback = {
        wasCorrect: false,
        requiredManualFix: true,
        manualFixType: selectedValue,
        manualFixNotes: notes || undefined,
      };
      onBulkFeedback(ids, feedback);
    }

    setDialogOpen(false);
    onClearSelection();
  };

  if (selectedCount === 0) return null;

  const stepTitle = step === 'question'
    ? 'Classify Selected Items'
    : flowType === 'bug' ? 'Select Bug Category'
    : flowType === 'passed-locally' ? 'Select Reason'
    : 'Select Fix Type';

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
            <Button size="sm" variant="outline" onClick={openDialog}>
              <ListChecks className="h-4 w-4 mr-1" />
              Classify...
            </Button>
          </div>
        </div>
      </div>

      {/* Multi-step Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && setDialogOpen(false)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{stepTitle}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Applying to <span className="font-medium text-foreground">{selectedCount}</span> selected items
            </p>

            {step === 'question' && (
              <div className="flex flex-col gap-2">
                <Button variant="outline" className="justify-start text-bug border-bug/30" onClick={() => handleFlowChoice('bug')}>
                  <Bug className="h-4 w-4 mr-2" />
                  Yes, it was a bug
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => handleFlowChoice('passed-locally')}>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  No, passed locally
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => handleFlowChoice('manual-fix')}>
                  <Wrench className="h-4 w-4 mr-2" />
                  Required manual fix
                </Button>
              </div>
            )}

            {step === 'category' && (
              <>
                {loadingCategories ? (
                  <p className="text-sm text-muted-foreground">Loading categories...</p>
                ) : (
                  <Select value={selectedValue} onValueChange={setSelectedValue}>
                    <SelectTrigger>
                      <SelectValue placeholder={
                        flowType === 'bug' ? 'Select bug category...'
                        : flowType === 'passed-locally' ? 'Select reason...'
                        : 'Select fix type...'
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {currentCategories.map(c => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {flowType === 'bug' && (
                  <Input
                    placeholder="Bug link (optional)"
                    value={bugLink}
                    onChange={e => setBugLink(e.target.value)}
                  />
                )}

                <Textarea
                  placeholder="Notes (optional)"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="min-h-[60px] resize-none"
                />
              </>
            )}
          </div>

          <DialogFooter>
            {step === 'category' && (
              <Button variant="outline" onClick={() => { setStep('question'); setFlowType(null); setSelectedValue(''); setNotes(''); setBugLink(''); }}>
                Back
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            {step === 'category' && (
              <Button onClick={handleConfirm} disabled={!selectedValue}>
                Apply to {selectedCount} items
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
