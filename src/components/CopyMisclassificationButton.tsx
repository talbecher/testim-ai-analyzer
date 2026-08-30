import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { aiRecommendedInvestigate } from '@/lib/aiInvestigateRecommendation';
import { coercePriorityReasonText } from '@/lib/priorityReasonToggle';
import { AnalyzedFailureWithFeedback } from '@/types/feedback';

function buildMisclassificationReport(failure: AnalyzedFailureWithFeedback): string {
  const analysis = failure.analysis;
  const feedback = failure.feedback;

  const shouldInvestigate = aiRecommendedInvestigate({
    classification: analysis?.classification,
    priority: analysis?.priority,
    confidence: analysis?.confidence,
    passedLocally: null,
    forceInvestigate: analysis?.forceInvestigate ?? false,
  });

  const errorMessage = (failure.errorMessage ?? '').slice(0, 300);
  const priorityReason = coercePriorityReasonText(analysis?.priorityReason);

  const userOutcome = feedback?.passedLocally
    ? 'Passed locally (no bug)'
    : feedback?.requiredManualFix
      ? 'Required manual fix'
      : feedback?.userClassification ?? 'Unknown';

  const correctDecision = feedback?.passedLocally ? 'Skip' : 'Investigate';

  return `=== MISCLASSIFICATION REPORT ===
Test: ${failure.testName}
Error Pattern: ${analysis?.errorPattern ?? 'N/A'}
Error: ${errorMessage}

AI Decision: ${shouldInvestigate ? 'Investigate' : 'Skip'}
Classification: ${analysis?.classification ?? 'N/A'} | ${analysis?.priority ?? 'N/A'} | ${analysis?.confidence ?? 0}%
Signals / Reasoning: ${priorityReason}
Flaky KB Match: ${analysis?.flakyKBMatch ? 'Yes' : 'No'}

User Outcome: ${userOutcome}
Correct Decision: ${correctDecision}
=== END ===`;
}

interface CopyMisclassificationButtonProps {
  failure: AnalyzedFailureWithFeedback;
}

export function CopyMisclassificationButton({ failure }: CopyMisclassificationButtonProps) {
  const { toast } = useToast();

  if (!failure.isReviewed || failure.feedback?.wasCorrect !== false) {
    return null;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildMisclassificationReport(failure));
      toast({
        title: 'Copied!',
        duration: 2000,
      });
    } catch (err) {
      console.error('Failed to copy misclassification report:', err);
    }
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-6 text-xs text-muted-foreground hover:text-foreground"
      onClick={handleCopy}
    >
      <Copy className="h-3 w-3 mr-1" />
      Copy misclassification
    </Button>
  );
}
