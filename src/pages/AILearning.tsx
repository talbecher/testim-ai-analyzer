import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useReports } from '@/hooks/useReports';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Brain, TrendingUp, Zap, ArrowRightLeft, CheckCircle, FileText, BarChart3, Settings as SettingsIcon } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LearningBoostButton } from '@/components/LearningBoostButton';
import { cn } from '@/lib/utils';

const classColors: Record<string, string> = {
  'Potential bug': 'bg-bug text-bug-foreground',
  'Likely Flaky': 'bg-flaky text-flaky-foreground',
  'Environment / Infra Issue': 'bg-environment text-environment-foreground',
  'Expected Change': 'bg-expected text-expected-foreground',
};

export default function AILearning() {
  const { learningInsights, isLoading, fetchLearningInsights, getLearningStats } = useReports();

  useEffect(() => {
    fetchLearningInsights();
  }, [fetchLearningInsights]);

  const stats = useMemo(() => {
    const total = learningInsights.reduce((sum, i) => sum + i.count, 0);
    const uniquePatterns = learningInsights.length;
    
    // Group by correction type
    const correctionTypes = new Map<string, number>();
    learningInsights.forEach(i => {
      const key = `${i.aiClassification} → ${i.userClassification}`;
      correctionTypes.set(key, (correctionTypes.get(key) || 0) + i.count);
    });
    
    const topCorrections = Array.from(correctionTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { total, uniquePatterns, topCorrections };
  }, [learningInsights]);

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
                  <h4 className="font-medium">Collect Corrections</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  When you mark AI classifications as wrong and provide correct ones, these are saved.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-background/50 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">2</div>
                  <h4 className="font-medium">Build Context</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Before each analysis, past corrections are loaded and added to the AI prompt as context.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-background/50 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">3</div>
                  <h4 className="font-medium">Improve Predictions</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  The AI sees what it got wrong before and adjusts its classification for similar patterns.
                </p>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                <strong>Note:</strong> This is not true model fine-tuning. The AI considers historical corrections as hints, 
                but there's no guarantee it will change predictions. The more corrections for a specific pattern, 
                the stronger the signal to the AI.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Learning Boost */}
        <LearningBoostButton />

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-foreground">{stats.total}</div>
                  <div className="text-sm text-muted-foreground">Total Corrections</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <ArrowRightLeft className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-foreground">{stats.uniquePatterns}</div>
                  <div className="text-sm text-muted-foreground">Unique Patterns Learned</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-foreground">
                    {stats.total > 0 ? 'Active' : 'Waiting'}
                  </div>
                  <div className="text-sm text-muted-foreground">Learning Status</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Correction Types */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              Most Common Corrections
            </CardTitle>
            <CardDescription>
              These are the classification changes the AI is learning from
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : stats.topCorrections.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No corrections yet</p>
                <p className="text-sm mt-1">The AI will start learning once you correct some classifications</p>
              </div>
            ) : (
              <div className="space-y-4">
                {stats.topCorrections.map(([correction, count], idx) => {
                  const [from, to] = correction.split(' → ');
                  const maxCount = stats.topCorrections[0][1];
                  const percentage = (count / maxCount) * 100;
                  
                  return (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={cn("text-xs", classColors[from] || 'bg-muted')}>
                            {from}
                          </Badge>
                          <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                          <Badge className={cn("text-xs", classColors[to] || 'bg-muted')}>
                            {to}
                          </Badge>
                        </div>
                        <span className="text-sm font-medium text-foreground">{count}x</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* All Learned Patterns */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              All Learned Patterns
            </CardTitle>
            <CardDescription>
              Specific error patterns and how the AI should classify them
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(10)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : learningInsights.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No patterns learned yet</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {learningInsights.map((insight, idx) => (
                  <div 
                    key={idx} 
                    className="p-4 rounded-lg border border-border/50 bg-muted/20 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-xs", classColors[insight.aiClassification] || 'bg-muted')}>
                          {insight.aiClassification}
                        </Badge>
                        <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                        <Badge className={cn("text-xs", classColors[insight.userClassification] || 'bg-muted')}>
                          {insight.userClassification}
                        </Badge>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {insight.count}x corrected
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      Pattern: {insight.pattern || 'No specific pattern'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
