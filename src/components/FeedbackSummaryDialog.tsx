import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Save, Trash2, Target } from 'lucide-react';
import { FeedbackSummary } from '@/types/feedback';
import { cn } from '@/lib/utils';

interface FeedbackSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: FeedbackSummary;
  onSave: () => void;
  onDiscard: () => void;
  isSaving: boolean;
}

export function FeedbackSummaryDialog({
  open,
  onOpenChange,
  summary,
  onSave,
  onDiscard,
  isSaving
}: FeedbackSummaryDialogProps) {
  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 80) return 'text-confidence-high';
    if (accuracy >= 60) return 'text-flaky';
    return 'text-bug';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            AI Accuracy Summary
          </DialogTitle>
          <DialogDescription>
            How well did the AI recommend Investigate vs Skip?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Accuracy - Main Focus */}
          <div className="text-center space-y-2">
            <div className={cn("text-6xl font-bold", getAccuracyColor(summary.accuracyPercentage))}>
              {summary.accuracyPercentage.toFixed(0)}%
            </div>
            <Progress 
              value={summary.accuracyPercentage} 
              className="h-2"
            />
          </div>

          {/* Simple Stats */}
          <div className="flex justify-center gap-6 text-center">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-confidence-high" />
              <span className="text-lg font-semibold text-confidence-high">{summary.correctCount}</span>
              <span className="text-sm text-muted-foreground">correct</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-bug" />
              <span className="text-lg font-semibold text-bug">{summary.incorrectCount}</span>
              <span className="text-sm text-muted-foreground">wrong</span>
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            {summary.totalAnalyzed} failures analyzed
          </div>

          {/* Save Info */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm text-muted-foreground text-center">
            Save to help AI improve future recommendations
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onDiscard} disabled={isSaving}>
            <Trash2 className="mr-2 h-4 w-4" />
            Discard
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
