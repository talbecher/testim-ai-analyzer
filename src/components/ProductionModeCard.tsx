import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, X, Edit2, Database, Clock, Bug, TestTube, ExternalLink, Search, CircleSlash, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { aiRecommendedInvestigate } from '@/lib/aiInvestigateRecommendation';
import { AnalyzedFailureWithFeedback, UserFeedback } from '@/types/feedback';
import { Classification, Priority, SuggestedAction } from '@/types/testim';
import { BugConfirmationFlow } from './BugConfirmationFlow';
import { TestHistoryChip } from './TestHistoryChip';
import { PriorityReasonToggle } from './PriorityReasonToggle';
import { coercePriorityReasonText } from '@/lib/priorityReasonToggle';

interface ProductionModeCardProps {
  failure: AnalyzedFailureWithFeedback;
  onFeedback: (failureId: string, feedback: UserFeedback) => void;
  classColors: Record<string, string>;
  priorityColors: Record<string, string>;
}

const classifications: Classification[] = [
  'Potential bug',
  'Likely Flaky',
  'Environment / Infra Issue',
  'Expected Change',
  'Investigate'
];

const priorities: Priority[] = ['P0', 'P1', 'P2', 'P3'];

const actions: SuggestedAction[] = [
  'Open bug',
  'Update shared step',
  'Rerun only',
  'Ignore today / monitor',
  'Verify manually'
];

export function ProductionModeCard({ failure, onFeedback, classColors, priorityColors }: ProductionModeCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showBugConfirmation, setShowBugConfirmation] = useState(false);
  const [editValues, setEditValues] = useState({
    classification: failure.analysis?.classification,
    priority: failure.analysis?.priority,
    action: failure.analysis?.suggestedAction
  });

  // Show bug confirmation flow automatically for unreviewed items
  useEffect(() => {
    if (failure.analysis && !failure.isReviewed && !isEditing) {
      setShowBugConfirmation(true);
    }
  }, [failure.analysis, failure.isReviewed, isEditing]);

  const handleConfirmAI = () => {
    onFeedback(failure.id, {
      wasCorrect: true,
      userClassification: failure.analysis?.classification,
      userPriority: failure.analysis?.priority,
      userAction: failure.analysis?.suggestedAction
    });
    setShowBugConfirmation(false);
  };

  const handleConfirmBug = (category: string, bugLink?: string) => {
    // AI is correct if it recommended investigation (bug found = investigation was right)
    onFeedback(failure.id, {
      wasCorrect: shouldInvestigate,
      userClassification: failure.analysis?.classification,
      userPriority: failure.analysis?.priority,
      userAction: failure.analysis?.suggestedAction,
      bugCategory: category,
      bugLink: bugLink
    });
    setShowBugConfirmation(false);
  };

  const handlePassedLocally = (reason: string, notes?: string) => {
    // AI is correct if it recommended to SKIP (no bug = skip was right)
    onFeedback(failure.id, {
      wasCorrect: !shouldInvestigate,
      userClassification: failure.analysis?.classification,
      userPriority: failure.analysis?.priority,
      userAction: failure.analysis?.suggestedAction,
      passedLocally: true,
      passedLocallyReason: reason,
      passedLocallyNotes: notes
    });
    setShowBugConfirmation(false);
  };

  const handleRequiredManualFix = (fixType: string, notes?: string) => {
    // AI is correct if it recommended investigation (manual fix = work was needed)
    onFeedback(failure.id, {
      wasCorrect: shouldInvestigate,
      userClassification: failure.analysis?.classification,
      userPriority: failure.analysis?.priority,
      userAction: failure.analysis?.suggestedAction,
      requiredManualFix: true,
      manualFixType: fixType,
      manualFixNotes: notes
    });
    setShowBugConfirmation(false);
  };

  const handleCancelBugFlow = () => {
    setShowBugConfirmation(false);
  };

  const handleEditClick = () => {
    // Reset to options selection instead of showing correction form
    setShowBugConfirmation(true);
    setIsEditing(false);
  };

  const handleSaveCorrection = () => {
    onFeedback(failure.id, {
      wasCorrect: false,
      userClassification: editValues.classification,
      userPriority: editValues.priority,
      userAction: editValues.action
    });
    setIsEditing(false);
  };

  const isReviewed = failure.isReviewed;

  const shouldInvestigate = aiRecommendedInvestigate({
    classification: failure.analysis?.classification,
    priority: failure.analysis?.priority,
    confidence: failure.analysis?.confidence,
    passedLocally: failure.feedback?.passedLocally ?? null,
  });

  return (
    <Card className={cn(
      "animate-fade-in border-border/50 transition-all duration-200",
      isReviewed && failure.feedback?.wasCorrect && "border-l-4 border-l-confidence-high bg-confidence-high/5",
      isReviewed && !failure.feedback?.wasCorrect && "border-l-4 border-l-bug bg-bug/5",
      !isReviewed && "hover:border-border"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Test Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {isReviewed && (
                <div className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center",
                  failure.feedback?.wasCorrect ? "bg-confidence-high" : "bg-bug"
                )}>
                  {failure.feedback?.wasCorrect ? (
                    <Check className="h-3 w-3 text-white" />
                  ) : (
                    <X className="h-3 w-3 text-white" />
                  )}
                </div>
              )}
              <h3 className="font-mono text-sm font-bold truncate text-foreground">{failure.testName}</h3>
            </div>
            {failure.errorMessage && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{failure.errorMessage}</p>
            )}
          </div>

          {/* Reviewing status indicator */}
          {failure.isAnalyzing && (
            <div className="animate-pulse text-muted-foreground text-sm">Analyzing...</div>
          )}

        </div>

        {/* PRIMARY: Investigation Recommendation (single-line strip) */}
        {failure.analysis && !isEditing && !isReviewed && (
          <div
            className={cn(
              'mt-3 flex min-h-[2.25rem] items-center gap-2 rounded-md border py-1.5 pl-2 pr-2.5',
              shouldInvestigate
                ? 'border-bug/30 bg-bug/10'
                : 'border-confidence-high/30 bg-confidence-high/10',
            )}
          >
            {shouldInvestigate ? (
              <Search className="h-4 w-4 shrink-0 text-bug" />
            ) : (
              <CircleSlash className="h-4 w-4 shrink-0 text-confidence-high" />
            )}
            <span
              className={cn(
                'min-w-0 truncate text-sm font-medium',
                shouldInvestigate ? 'text-bug' : 'text-confidence-high',
              )}
            >
              {shouldInvestigate ? 'Recommended: Investigate' : 'Recommended: Skip investigation'}
            </span>
          </div>
        )}

        {/* SECONDARY: Classification Context */}
        {failure.analysis && !isEditing && !isReviewed && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="font-medium">Context:</span>
            <span className={cn("px-1.5 py-0.5 rounded opacity-80", classColors[failure.analysis.classification])}>
              {failure.analysis.classification}
            </span>
            <span className="opacity-50">•</span>
            <span className={cn("px-1.5 py-0.5 rounded opacity-80 text-white", priorityColors[failure.analysis.priority])}>
              {failure.analysis.priority}
            </span>
            <span className="opacity-50">•</span>
            <span>{failure.analysis.confidence}% confidence</span>
            {failure.analysis.history && (
              <>
                <span className="opacity-50">•</span>
                <TestHistoryChip history={failure.analysis.history} />
              </>
            )}
            {failure.analysis.flakyKBMatch && (
              <>
                <span className="opacity-50">•</span>
                <span
                  title="Matched known flaky test"
                  className="inline-flex shrink-0 items-center gap-1 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-primary"
                >
                  <Database className="h-3 w-3" aria-hidden />
                  Flaky KB
                </span>
              </>
            )}
            {failure.analysis.requiresRerun && (
              <>
                <span className="opacity-50">•</span>
                <Clock className="h-3 w-3 text-environment" />
                <span className="text-environment">Rerun suggested</span>
              </>
            )}
          </div>
        )}

        {/* Priority Reason - secondary detail */}
        {failure.analysis?.priorityReason != null &&
          coercePriorityReasonText(failure.analysis.priorityReason).trim() !== '' &&
          !isEditing &&
          !isReviewed && (
          <PriorityReasonToggle
            key={`${failure.id}-pr`}
            text={failure.analysis.priorityReason}
            className="opacity-70"
          />
        )}

        {/* Bug Confirmation Flow - actions for the recommendation */}
        {showBugConfirmation && (
          <div className="mt-3">
            <BugConfirmationFlow
              onConfirmBug={handleConfirmBug}
              onPassedLocally={handlePassedLocally}
              onRequiredManualFix={handleRequiredManualFix}
              onCancel={handleCancelBugFlow}
            />
          </div>
        )}

        {/* Correction Form */}
        {isEditing && (
          <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
            <div className="text-xs text-muted-foreground font-medium">Correct the AI suggestion:</div>
            <div className="grid grid-cols-3 gap-2">
              <Select
                value={editValues.classification}
                onValueChange={(v) => setEditValues(prev => ({ ...prev, classification: v as Classification }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Classification" />
                </SelectTrigger>
                <SelectContent>
                  {classifications.map(c => (
                    <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select
                value={editValues.priority}
                onValueChange={(v) => setEditValues(prev => ({ ...prev, priority: v as Priority }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map(p => (
                    <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={editValues.action}
                onValueChange={(v) => setEditValues(prev => ({ ...prev, action: v as SuggestedAction }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  {actions.map(a => (
                    <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={handleSaveCorrection}>
                Save Correction
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Show correction/feedback info if reviewed */}
        {isReviewed && !isEditing && (
          <div className="mt-2 text-xs space-y-1">
            {/* Passed Locally indicator */}
            {failure.feedback?.passedLocally && (
              <div className="flex flex-col gap-1">
                <div className={cn("flex items-center gap-1", failure.feedback?.wasCorrect ? "text-confidence-high" : "text-bug")}>
                  <TestTube className="h-3 w-3" />
                  <span>Passed locally {failure.feedback?.wasCorrect ? "(AI was correct)" : "(AI was wrong)"}</span>
                  {failure.feedback?.passedLocallyReason && (
                    <span className="px-1.5 py-0.5 rounded bg-confidence-high/10 font-medium">
                      {failure.feedback.passedLocallyReason}
                    </span>
                  )}
                </div>
                {failure.feedback?.passedLocallyNotes && (
                  <p className="text-muted-foreground italic pl-4">{failure.feedback.passedLocallyNotes}</p>
                )}
              </div>
            )}

            {/* Required Manual Fix indicator */}
            {failure.feedback?.requiredManualFix && (
              <div className="flex flex-col gap-1">
                <div className={cn("flex items-center gap-1", failure.feedback?.wasCorrect ? "text-confidence-high" : "text-bug")}>
                  <Wrench className="h-3 w-3" />
                  <span>Required manual fix {failure.feedback?.wasCorrect ? "(AI was correct)" : "(AI was wrong)"}</span>
                  {failure.feedback?.manualFixType && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/10 font-medium">
                      {failure.feedback.manualFixType}
                    </span>
                  )}
                </div>
                {failure.feedback?.manualFixNotes && (
                  <p className="text-muted-foreground italic pl-4">{failure.feedback.manualFixNotes}</p>
                )}
              </div>
            )}

            {/* Bug category and link */}
            {failure.feedback?.bugCategory && (
              <div className="flex items-center gap-2">
                <Bug className="h-3 w-3 text-bug" />
                <span className="px-1.5 py-0.5 rounded bg-bug/10 text-bug font-medium">
                  {failure.feedback.bugCategory}
                </span>
                {failure.feedback?.bugLink && (
                  <a 
                    href={failure.feedback.bugLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View Bug
                  </a>
                )}
              </div>
            )}

            {/* Standard correction display */}
            {!failure.feedback?.wasCorrect && failure.feedback?.userClassification && !failure.feedback?.passedLocally && (
              <div>
                <span className="text-muted-foreground">Corrected to: </span>
                <span className={cn("px-1.5 py-0.5 rounded font-medium", classColors[failure.feedback.userClassification])}>
                  {failure.feedback.userClassification}
                </span>
                {failure.feedback.userPriority && (
                  <span className={cn("ml-1 px-1.5 py-0.5 rounded font-medium text-white", priorityColors[failure.feedback.userPriority])}>
                    {failure.feedback.userPriority}
                  </span>
                )}
              </div>
            )}

            {/* Edit button for reviewed items */}
            {!isEditing && (
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-6 text-xs mt-1"
                onClick={handleEditClick}
              >
                <Edit2 className="h-3 w-3 mr-1" />
                Edit
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
