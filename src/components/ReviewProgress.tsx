import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { CheckCircle, ClipboardCheck } from 'lucide-react';

interface ReviewProgressProps {
  reviewed: number;
  total: number;
  onComplete: () => void;
}

export function ReviewProgress({ reviewed, total, onComplete }: ReviewProgressProps) {
  const percentage = total > 0 ? (reviewed / total) * 100 : 0;
  const isComplete = reviewed === total && total > 0;

  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-foreground">Review Progress</span>
              <span className="text-sm text-muted-foreground">{reviewed} / {total}</span>
            </div>
            <Progress value={percentage} className="h-2" />
          </div>
        </div>
        {isComplete && (
          <Button onClick={onComplete} className="bg-confidence-high hover:bg-confidence-high/90">
            <CheckCircle className="mr-2 h-4 w-4" />
            Complete Review
          </Button>
        )}
      </div>
    </div>
  );
}
