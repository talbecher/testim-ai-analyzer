import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, BookOpen, ExternalLink, Search, CircleSlash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalyzedFailureWithFeedback } from '@/types/feedback';
import { PreClassifiedData } from '@/types/testim';
import { Separator } from '@/components/ui/separator';

interface LearningModeCardProps {
  failure: AnalyzedFailureWithFeedback;
  classColors: Record<string, string>;
  priorityColors: Record<string, string>;
}

// Determine if manual work was actually needed based on human classification
const requiredManualWork = (preClassified: PreClassifiedData | undefined): boolean => {
  if (!preClassified?.failureType) return false;
  const type = preClassified.failureType.toLowerCase();
  const subType = preClassified.failureSubType?.toLowerCase() || '';
  
  // Worked locally = NO manual work needed
  if (subType.includes('worked locally') || subType.includes('works locally')) {
    return false;
  }
  
  // Bug in App = manual work needed
  if (type.includes('bug')) return true;
  
  // Test design/update/reassign = manual work needed  
  if (type.includes('test design') || type.includes('update') || type.includes('ui')) return true;
  if (subType.includes('reassign')) return true;
  
  // Environment/Infra = manual work needed
  if (type.includes('environment') || type.includes('infra')) return true;
  
  return true; // Default: assume manual work needed
};

// Get a friendly description of what work was needed
const getWorkDescription = (preClassified: PreClassifiedData | undefined): string => {
  if (!preClassified?.failureType) return 'Unknown';
  const type = preClassified.failureType.toLowerCase();
  const subType = preClassified.failureSubType?.toLowerCase() || '';
  
  if (subType.includes('worked locally') || subType.includes('works locally')) {
    return 'Worked locally';
  }
  if (subType.includes('reassign')) {
    return 'Reassign';
  }
  if (type.includes('bug')) {
    return 'Bug fix';
  }
  if (type.includes('test design') || type.includes('update') || type.includes('ui')) {
    return 'Test update';
  }
  if (type.includes('environment') || type.includes('infra')) {
    return 'Environment issue';
  }
  
  return preClassified.failureSubType || preClassified.failureType || 'Other';
};

export function LearningModeCard({ failure }: LearningModeCardProps) {
  const bugLink = failure.preClassified?.bugLink;
  
  // AI recommendation: would it suggest investigating?
  const aiRecommendedInvestigate = failure.analysis?.classification === 'Potential bug' || 
                                    failure.analysis?.priority === 'P0' || 
                                    failure.analysis?.priority === 'P1';

  // Did this actually need manual work?
  const neededManualWork = requiredManualWork(failure.preClassified);
  const workDescription = getWorkDescription(failure.preClassified);

  // AI is correct if recommendation matched actual need
  const wasAICorrect = aiRecommendedInvestigate === neededManualWork;

  return (
    <Card className={cn(
      "animate-fade-in transition-all duration-200",
      wasAICorrect 
        ? "border-l-4 border-l-confidence-high bg-confidence-high/5" 
        : "border-l-4 border-l-bug bg-bug/5"
    )}>
      <CardContent className="p-4 space-y-3">
        {/* Header - Test Name & Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className={cn(
              "w-5 h-5 rounded-full flex items-center justify-center shrink-0",
              wasAICorrect ? "bg-confidence-high" : "bg-bug"
            )}>
              {wasAICorrect ? (
                <Check className="h-3 w-3 text-white" />
              ) : (
                <X className="h-3 w-3 text-white" />
              )}
            </div>
            <h3 className="font-mono text-sm font-medium truncate text-foreground">
              {failure.testName}
            </h3>
          </div>
          <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary shrink-0">
            <BookOpen className="h-3 w-3 mr-1" />
            Human Verified
          </Badge>
        </div>

        {/* Error Message */}
        {failure.errorMessage && (
          <p className="text-xs text-muted-foreground truncate pl-7">
            {failure.errorMessage}
          </p>
        )}

        <Separator className="my-2" />

        {/* AI Recommendation */}
        <div className={cn(
          "p-3 rounded-md border",
          aiRecommendedInvestigate 
            ? "bg-bug/10 border-bug/30" 
            : "bg-confidence-high/10 border-confidence-high/30"
        )}>
          <div className="flex items-center gap-2">
            {aiRecommendedInvestigate ? (
              <>
                <Search className="h-4 w-4 text-bug" />
                <span className="font-medium text-bug text-sm">AI Recommendation: Investigate</span>
              </>
            ) : (
              <>
                <CircleSlash className="h-4 w-4 text-confidence-high" />
                <span className="font-medium text-confidence-high text-sm">AI Recommendation: Skip investigation</span>
              </>
            )}
          </div>
          {failure.analysis && (
            <p className="text-xs text-muted-foreground mt-1 ml-6">
              Classification: {failure.analysis.classification} • Priority: {failure.analysis.priority} • Confidence: {failure.analysis.confidence}%
            </p>
          )}
        </div>

        {/* Actual Outcome */}
        <div className={cn(
          "p-3 rounded-md border",
          neededManualWork 
            ? "bg-muted/50 border-border" 
            : "bg-confidence-high/5 border-confidence-high/20"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {neededManualWork ? (
                <Badge variant="secondary" className="font-medium">
                  Required manual work
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-confidence-high/10 border-confidence-high/30 text-confidence-high font-medium">
                  No manual work needed
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">({workDescription})</span>
            </div>
            {bugLink && (
              <a 
                href={bugLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline text-xs"
              >
                <ExternalLink className="h-3 w-3" />
                Bug Link
              </a>
            )}
          </div>
        </div>

        <Separator className="my-2" />

        {/* Result - AI Accuracy */}
        <div className="flex items-center justify-center">
          <Badge 
            variant={wasAICorrect ? "default" : "destructive"} 
            className={cn(
              "text-sm px-4 py-1",
              wasAICorrect && "bg-confidence-high hover:bg-confidence-high/90"
            )}
          >
            {wasAICorrect ? (
              <>
                <Check className="h-4 w-4 mr-1" />
                AI Recommendation Correct
              </>
            ) : (
              <>
                <X className="h-4 w-4 mr-1" />
                AI Recommendation Wrong
              </>
            )}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
