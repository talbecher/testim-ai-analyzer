import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, Database, BookOpen, ExternalLink, TestTube, Bug } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalyzedFailureWithFeedback } from '@/types/feedback';

interface LearningModeCardProps {
  failure: AnalyzedFailureWithFeedback;
  classColors: Record<string, string>;
  priorityColors: Record<string, string>;
}

export function LearningModeCard({ failure, classColors, priorityColors }: LearningModeCardProps) {
  const wasCorrect = failure.feedback?.wasCorrect ?? (
    failure.analysis?.classification === failure.feedback?.userClassification
  );

  const humanClassification = failure.feedback?.userClassification || failure.preClassified?.failureType;
  const aiClassification = failure.analysis?.classification;

  return (
    <Card className={cn(
      "animate-fade-in border-border/50 transition-all duration-200",
      wasCorrect ? "border-l-4 border-l-confidence-high bg-confidence-high/5" : "border-l-4 border-l-bug bg-bug/5"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Test Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center",
                wasCorrect ? "bg-confidence-high" : "bg-bug"
              )}>
                {wasCorrect ? (
                  <Check className="h-3 w-3 text-white" />
                ) : (
                  <X className="h-3 w-3 text-white" />
                )}
              </div>
              <h3 className="font-mono text-sm font-medium truncate text-foreground">{failure.testName}</h3>
            </div>
            {failure.errorMessage && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{failure.errorMessage}</p>
            )}
          </div>

          {/* Learning Mode Badge */}
          <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary">
            <BookOpen className="h-3 w-3 mr-1" />
            Human Verified
          </Badge>
        </div>

        {/* Classification Comparison */}
        <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
          {/* Human Classification (Ground Truth) */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground w-20">Human:</span>
            {humanClassification && (
              <>
                <span className={cn("px-2 py-0.5 rounded text-xs font-medium", classColors[humanClassification] || 'bg-muted')}>
                  {humanClassification}
                </span>
                {failure.feedback?.userPriority && (
                  <span className={cn("px-2 py-0.5 rounded text-xs font-medium text-white", priorityColors[failure.feedback.userPriority])}>
                    {failure.feedback.userPriority}
                  </span>
                )}
              </>
            )}
            {failure.feedback?.bugLink && (
              <a 
                href={failure.feedback.bugLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline text-xs"
              >
                <ExternalLink className="h-3 w-3" />
                Bug Link
              </a>
            )}
          </div>

          {/* AI Prediction (Read-only) */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground w-20">AI Predicted:</span>
            {aiClassification && (
              <>
                <span className={cn("px-2 py-0.5 rounded text-xs font-medium opacity-70", classColors[aiClassification] || 'bg-muted')}>
                  {aiClassification}
                </span>
                {failure.analysis?.priority && (
                  <span className={cn("px-2 py-0.5 rounded text-xs font-medium text-white opacity-70", priorityColors[failure.analysis.priority])}>
                    {failure.analysis.priority}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">({failure.analysis?.confidence}%)</span>
              </>
            )}
          </div>

          {/* AI Accuracy Indicator */}
          <div className="flex items-center gap-2 text-sm mt-2">
            <Badge variant={wasCorrect ? "default" : "destructive"} className="text-xs">
              {wasCorrect ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  AI was correct
                </>
              ) : (
                <>
                  <X className="h-3 w-3 mr-1" />
                  AI was wrong
                </>
              )}
            </Badge>
          </div>

          {/* Flaky KB Match */}
          {failure.analysis?.flakyKBMatch && (
            <div className="flex items-center gap-2 text-xs text-primary mt-2">
              <Database className="h-3 w-3" />
              <span>Known Flaky Test (Flaky KB)</span>
            </div>
          )}

          {/* Passed Locally indicator */}
          {failure.feedback?.passedLocally && (
            <div className="flex items-center gap-2 text-xs text-confidence-high mt-2">
              <TestTube className="h-3 w-3" />
              <span>Passed locally</span>
              {failure.feedback?.passedLocallyReason && (
                <span className="px-1.5 py-0.5 rounded bg-confidence-high/10 font-medium">
                  {failure.feedback.passedLocallyReason}
                </span>
              )}
            </div>
          )}

          {/* Bug Category */}
          {failure.feedback?.bugCategory && (
            <div className="flex items-center gap-2 text-xs mt-2">
              <Bug className="h-3 w-3 text-bug" />
              <span className="px-1.5 py-0.5 rounded bg-bug/10 text-bug font-medium">
                {failure.feedback.bugCategory}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
