import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLearningPatterns, LearningPattern, PatternExplanation } from '@/hooks/useLearningPatterns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, Brain, TrendingUp, Zap, AlertTriangle, CheckCircle, 
  FileText, BarChart3, Settings as SettingsIcon, Search, SkipForward,
  Lightbulb, Wrench, MessageSquare, Tag
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LearningBoostButton } from '@/components/LearningBoostButton';
import { cn } from '@/lib/utils';

const importanceColors: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  normal: 'bg-muted text-muted-foreground border-border',
};

interface PatternCardProps {
  pattern: LearningPattern & { explanation: PatternExplanation };
}

function PatternCard({ pattern }: PatternCardProps) {
  const { explanation } = pattern;
  
  return (
    <div className={cn(
      "p-4 rounded-lg border space-y-3",
      explanation.wasAIWrong ? "bg-destructive/5 border-destructive/20" : "bg-muted/20 border-border/50"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          {explanation.wasAIWrong ? (
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          ) : (
            <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
          )}
          <div>
            <p className="font-medium text-foreground">{explanation.title}</p>
            <p className="text-sm text-muted-foreground">{explanation.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className={cn("text-xs", importanceColors[pattern.importance])}>
            {pattern.importance}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {pattern.occurrence_count}x
          </Badge>
        </div>
      </div>

      {/* AI Recommendation vs Actual */}
      <div className="grid grid-cols-2 gap-3">
        <div className={cn(
          "p-3 rounded-md border",
          explanation.aiRecommendation === 'Investigate' 
            ? "bg-orange-500/10 border-orange-500/20" 
            : "bg-blue-500/10 border-blue-500/20"
        )}>
          <div className="flex items-center gap-2 mb-1">
            {explanation.aiRecommendation === 'Investigate' ? (
              <Search className="h-4 w-4 text-orange-500" />
            ) : (
              <SkipForward className="h-4 w-4 text-blue-500" />
            )}
            <span className="text-xs font-medium text-muted-foreground">AI Said</span>
          </div>
          <p className={cn(
            "font-medium",
            explanation.aiRecommendation === 'Investigate' ? "text-orange-600 dark:text-orange-400" : "text-blue-600 dark:text-blue-400"
          )}>
            {explanation.aiRecommendation}
          </p>
          {pattern.ai_classification && (
            <p className="text-xs text-muted-foreground mt-1">({pattern.ai_classification})</p>
          )}
        </div>

        <div className={cn(
          "p-3 rounded-md border",
          explanation.wasAIWrong
            ? "bg-destructive/10 border-destructive/20"
            : "bg-green-500/10 border-green-500/20"
        )}>
          <div className="flex items-center gap-2 mb-1">
            {explanation.wasAIWrong ? (
              <Wrench className="h-4 w-4 text-destructive" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
            <span className="text-xs font-medium text-muted-foreground">Actual Outcome</span>
          </div>
          <p className={cn(
            "font-medium",
            explanation.wasAIWrong ? "text-destructive" : "text-green-600 dark:text-green-400"
          )}>
            {explanation.actualOutcome}
          </p>
        </div>
      </div>

      {/* User Notes */}
      {explanation.userNotes.length > 0 && (
        <div className="p-3 rounded-md bg-muted/50 border border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">User Notes</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {explanation.userNotes.slice(0, 5).map((note, idx) => (
              <Badge key={idx} variant="outline" className="text-xs bg-background">
                "{note}"
              </Badge>
            ))}
            {explanation.userNotes.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{explanation.userNotes.length - 5} more
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* What AI Learned */}
      <div className="p-3 rounded-md bg-primary/5 border border-primary/20">
        <div className="flex items-center gap-2 mb-1">
          <Lightbulb className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-primary">What AI Learned</span>
        </div>
        <p className="text-sm text-foreground">{explanation.whatAILearned}</p>
      </div>

      {/* Error Pattern */}
      {pattern.error_pattern && pattern.error_pattern !== 'Other' && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Tag className="h-3 w-3" />
          <span>Error Pattern: {pattern.error_pattern}</span>
        </div>
      )}
    </div>
  );
}

export default function AILearning() {
  const { patterns, isLoading, fetchPatterns, getGroupedPatterns, getStats } = useLearningPatterns();

  useEffect(() => {
    fetchPatterns();
  }, [fetchPatterns]);

  const grouped = getGroupedPatterns();
  const stats = getStats();

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/reports">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">AI Learning Insights</h1>
                <p className="text-sm text-muted-foreground">See how the AI learns from your corrections</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <ThemeToggle />
            <Button asChild variant="outline" size="sm">
              <Link to="/reports">
                <FileText className="mr-2 h-4 w-4" />
                Reports
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/settings">
                <SettingsIcon className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard">
                <BarChart3 className="mr-2 h-4 w-4" />
                Dashboard
              </Link>
            </Button>
          </div>
        </header>

        {/* How It Works */}
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              How AI Learning Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              The AI uses <strong>Dynamic Prompt Engineering</strong> to improve its predictions based on your corrections:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-background/50 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">1</div>
                  <h4 className="font-medium">Collect Feedback</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  When you mark tests as "passed locally", need "manual fix", or correct classifications - all are saved.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-background/50 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">2</div>
                  <h4 className="font-medium">Analyze Patterns</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  AI analyzes your notes (like "Reassign Element") to understand what fixes you actually made.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-background/50 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">3</div>
                  <h4 className="font-medium">Improve Recommendations</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Future analyses use these patterns to better recommend "Investigate" vs "Skip".
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Learning Boost */}
        <LearningBoostButton />

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-foreground">{stats.totalPatterns}</div>
                  <div className="text-sm text-muted-foreground">Learning Patterns</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-foreground">{stats.wrongRecommendations}</div>
                  <div className="text-sm text-muted-foreground">Wrong Recommendations</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <MessageSquare className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-foreground">{stats.notesInsights}</div>
                  <div className="text-sm text-muted-foreground">Notes Insights</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-orange-500/10">
                  <Zap className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-foreground">{stats.criticalPatterns}</div>
                  <div className="text-sm text-muted-foreground">Critical Patterns</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Wrong AI Recommendations */}
        {grouped.wrongRecommendations.length > 0 && (
          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                AI Recommendation Errors
              </CardTitle>
              <CardDescription>
                Cases where AI recommended wrong action - these are the key learnings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {grouped.wrongRecommendations.map((pattern) => (
                  <PatternCard key={pattern.id} pattern={pattern} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes Insights */}
        {grouped.notesInsights.length > 0 && (
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <MessageSquare className="h-5 w-5" />
                Insights from User Notes
              </CardTitle>
              <CardDescription>
                Patterns extracted from your free-text notes and comments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {grouped.notesInsights.map((pattern) => (
                  <div 
                    key={pattern.id}
                    className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-primary" />
                        <span className="font-medium text-foreground">
                          {pattern.extracted_keywords?.[0] || 'Pattern'}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {pattern.occurrence_count}x
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {pattern.user_notes_pattern}
                    </p>
                    <p className="text-sm text-primary">
                      → Suggests: {pattern.correct_classification}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Refined Classifications (AI was right but classification was refined) */}
        {grouped.refinedClassifications.length > 0 && (
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Confirmed Patterns
              </CardTitle>
              <CardDescription>
                Cases where AI recommendation was correct (classification may have been refined)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {grouped.refinedClassifications.map((pattern) => (
                  <PatternCard key={pattern.id} pattern={pattern} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {isLoading && (
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && patterns.length === 0 && (
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="text-center py-12 text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No learning patterns yet</p>
                <p className="text-sm mt-1">
                  The AI will start learning once you review some test failures and provide feedback
                </p>
                <p className="text-sm mt-4">
                  Click "Boost AI Learning" above after reviewing reports to aggregate patterns
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
