import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Save, Trash2, TrendingUp, AlertTriangle } from 'lucide-react';
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

  const getAccuracyBg = (accuracy: number) => {
    if (accuracy >= 80) return 'bg-confidence-high';
    if (accuracy >= 60) return 'bg-flaky';
    return 'bg-bug';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Analysis Summary
          </DialogTitle>
          <DialogDescription>
            Review complete! Here's how the AI performed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Accuracy Gauge */}
          <div className="text-center space-y-2">
            <div className={cn("text-5xl font-bold", getAccuracyColor(summary.accuracyPercentage))}>
              {summary.accuracyPercentage.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">AI Accuracy</div>
            <Progress 
              value={summary.accuracyPercentage} 
              className={cn("h-2", getAccuracyBg(summary.accuracyPercentage))}
            />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-foreground">{summary.totalAnalyzed}</div>
              <div className="text-xs text-muted-foreground">Total Analyzed</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-foreground">{summary.reviewedCount}</div>
              <div className="text-xs text-muted-foreground">Reviewed</div>
            </div>
            <div className="bg-confidence-high/10 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1">
                <CheckCircle className="h-4 w-4 text-confidence-high" />
                <span className="text-2xl font-bold text-confidence-high">{summary.correctCount}</span>
              </div>
              <div className="text-xs text-muted-foreground">Correct</div>
            </div>
            <div className="bg-bug/10 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1">
                <XCircle className="h-4 w-4 text-bug" />
                <span className="text-2xl font-bold text-bug">{summary.incorrectCount}</span>
              </div>
              <div className="text-xs text-muted-foreground">Incorrect</div>
            </div>
          </div>

          {/* Common Mistakes */}
          {summary.commonMistakes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <AlertTriangle className="h-4 w-4 text-flaky" />
                Common Mistakes
              </div>
              <div className="space-y-1">
                {summary.commonMistakes.slice(0, 3).map((mistake, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-muted/20 rounded px-2 py-1">
                    <span className="text-muted-foreground">{mistake.from}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium text-foreground">{mistake.to}</span>
                    <span className="ml-auto text-muted-foreground">({mistake.count}x)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save Info */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm text-muted-foreground">
            <strong className="text-foreground">Saving this report</strong> helps the AI learn from mistakes and improve future analyses.
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
