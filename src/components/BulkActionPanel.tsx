import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { X, Bug, PlayCircle, Wrench } from 'lucide-react';
import { UserFeedback } from '@/types/feedback';
import { AnalyzedFailureWithFeedback } from '@/types/feedback';
import { useBugCategories } from '@/hooks/useBugCategories';
import { aiRecommendedInvestigate } from '@/lib/aiInvestigateRecommendation';

type FlowType = 'bug' | 'passed-locally' | 'manual-fix';

interface BulkActionPanelProps {
  selectedCount: number;
  selectedFailures: AnalyzedFailureWithFeedback[];
  onBulkFeedback: (
    ids: string[],
    feedback: UserFeedback | ((failure: AnalyzedFailureWithFeedback) => UserFeedback)
  ) => void;
  onClearSelection: () => void;
}

export function BulkActionPanel({
  selectedCount,
  selectedFailures,
  onBulkFeedback,
  onClearSelection,
}: BulkActionPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
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

  const openFlowDialog = async (flow: FlowType) => {
    setFlowType(flow);
    setSelectedValue('');
    setNotes('');
    setBugLink('');
    setDialogOpen(true);
    await loadCategories(flow);
  };

  const currentCategories = flowType ? cachedCategories[getCategoryType(flowType)] || [] : [];

  const handleConfirm = () => {
    const ids = selectedFailures.map(f => f.id);

    if (flowType === 'passed-locally') {
      // AI was correct if it recommended SKIP (passed locally = no investigation needed)
      onBulkFeedback(ids, (f) => ({
        wasCorrect: !aiRecommendedInvestigate({
          classification: f.analysis?.classification,
          priority: f.analysis?.priority,
        }),
        userClassification: f.analysis?.classification,
        userPriority: f.analysis?.priority,
        userAction: f.analysis?.suggestedAction,
        passedLocally: true,
        passedLocallyReason: selectedValue,
        passedLocallyNotes: notes || undefined,
      }));
    } else if (flowType === 'bug') {
      // AI was correct if it recommended INVESTIGATE (real bug = investigation was right)
      onBulkFeedback(ids, (f) => ({
        wasCorrect: aiRecommendedInvestigate({
          classification: f.analysis?.classification,
          priority: f.analysis?.priority,
        }),
        userClassification: f.analysis?.classification,
        userPriority: f.analysis?.priority,
        userAction: f.analysis?.suggestedAction,
        bugCategory: selectedValue,
        bugLink: bugLink || undefined,
        userNotes: notes || undefined,
      }));
    } else if (flowType === 'manual-fix') {
      // AI was correct if it recommended INVESTIGATE (manual fix needed = work was needed)
      onBulkFeedback(ids, (f) => ({
        wasCorrect: aiRecommendedInvestigate({
          classification: f.analysis?.classification,
          priority: f.analysis?.priority,
        }),
        userClassification: f.analysis?.classification,
        userPriority: f.analysis?.priority,
        userAction: f.analysis?.suggestedAction,
        requiredManualFix: true,
        manualFixType: selectedValue,
        manualFixNotes: notes || undefined,
      }));
    }

    setDialogOpen(false);
    onClearSelection();
  };

  if (selectedCount === 0) return null;

  const dialogTitle = flowType === 'bug' ? 'Select Bug Category'
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
            <Button size="sm" variant="outline" className="text-bug border-bug/30" onClick={() => openFlowDialog('bug')}>
              <Bug className="h-4 w-4 mr-1" />
              Yes, it was a bug
            </Button>
            <Button size="sm" variant="outline" onClick={() => openFlowDialog('passed-locally')}>
              <PlayCircle className="h-4 w-4 mr-1" />
              No, passed locally
            </Button>
            <Button size="sm" variant="outline" onClick={() => openFlowDialog('manual-fix')}>
              <Wrench className="h-4 w-4 mr-1" />
              Required manual fix
            </Button>
          </div>
        </div>
      </div>

      {/* Category Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && setDialogOpen(false)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Applying to <span className="font-medium text-foreground">{selectedCount}</span> selected items
            </p>

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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={!selectedValue}>
              Apply to {selectedCount} items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}