import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, BookOpen, ExternalLink, User, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalyzedFailureWithFeedback } from '@/types/feedback';
import { PreClassifiedData } from '@/types/testim';
import { Separator } from '@/components/ui/separator';

interface LearningModeCardProps {
  failure: AnalyzedFailureWithFeedback;
  classColors: Record<string, string>;
  priorityColors: Record<string, string>;
}

// Check if this is a confirmed bug (Bug in App + has bug link)
const isConfirmedBug = (preClassified: PreClassifiedData | undefined): boolean => {
  if (!preClassified?.failureType || !preClassified?.bugLink) return false;
  const type = preClassified.failureType.toLowerCase();
  return type.includes('bug') && preClassified.bugLink.trim().length > 0;
};

// Get the reason why it's not a bug
const getNotBugReason = (preClassified: PreClassifiedData | undefined): string => {
  if (!preClassified?.failureType) return 'Unknown';
  
  const type = preClassified.failureType.toLowerCase();
  const subType = preClassified.failureSubType?.toLowerCase() || '';
  
  // Check subtype first for more specific reasons
  if (subType.includes('worked locally') || subType.includes('works locally')) 
    return 'Worked Locally';
  if (subType.includes('reassign')) 
    return 'Reassign';
  
  // Check main type
  if (type.includes('test design') || type.includes('update') || type.includes('ui')) 
    return 'UI/Test Update';
  if (type.includes('environment') || type.includes('infra')) 
    return 'Environment Issue';
  
  // Bug without link
  if (type.includes('bug') && !preClassified.bugLink) 
    return 'Missing Bug Link';
  
  // Fallback to subtype or failure type
  return preClassified.failureSubType || preClassified.failureType || 'Other';
};

export function LearningModeCard({ failure }: LearningModeCardProps) {
  const humanFailureType = failure.preClassified?.failureType;
  const bugLink = failure.preClassified?.bugLink;
  const aiClassification = failure.analysis?.classification;
  
  const confirmedBug = isConfirmedBug(failure.preClassified);
  const notBugReason = !confirmedBug ? getNotBugReason(failure.preClassified) : null;
  
  // AI is correct if:
  // - Human confirmed bug AND AI said "Potential bug"
  // - Human didn't confirm bug AND AI said something other than "Potential bug"
  const aiSaidBug = aiClassification === 'Potential bug';
  const wasAICorrect = aiSaidBug === confirmedBug;

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

        {/* Comparison Section */}
        <div className="space-y-2 text-sm">
          {/* Human Classification */}
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground w-14">Human:</span>
            {humanFailureType && (
              <Badge variant="secondary" className="font-medium">
                {humanFailureType}
              </Badge>
            )}
            {bugLink && (
              <a 
                href={bugLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline text-xs ml-auto"
              >
                <ExternalLink className="h-3 w-3" />
                Bug Link
              </a>
            )}
          </div>

          {/* AI Classification */}
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground w-14">AI:</span>
            {aiClassification && (
              <Badge variant="outline" className="font-medium opacity-80">
                {aiClassification}
              </Badge>
            )}
          </div>
        </div>

        <Separator className="my-2" />

        {/* Result Section */}
        <div className="flex items-center justify-between gap-2">
          {/* Bug Status */}
          {confirmedBug ? (
            <Badge className="bg-bug text-white">
              🐛 Confirmed Bug
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-muted-foreground">
              Not a Bug: {notBugReason}
            </Badge>
          )}

          {/* AI Accuracy */}
          <Badge variant={wasAICorrect ? "default" : "destructive"} className="text-xs">
            {wasAICorrect ? (
              <>
                <Check className="h-3 w-3 mr-1" />
                AI Correct
              </>
            ) : (
              <>
                <X className="h-3 w-3 mr-1" />
                AI Wrong
              </>
            )}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
