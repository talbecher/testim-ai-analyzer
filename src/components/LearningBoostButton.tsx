import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, Loader2, CheckCircle, AlertCircle, Brain } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface BoostStats {
  totalCorrections: number;
  totalPassedLocally: number;
  totalManualFixes: number;
  uniquePatterns: number;
  criticalPatterns: number;
  highPatterns: number;
  normalPatterns: number;
  timestamp: string;
}

export function LearningBoostButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastBoost, setLastBoost] = useState<BoostStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleBoost = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('aggregate-learning');

      if (fnError) throw fnError;

      if (data?.success) {
        setLastBoost(data.stats);
        toast({
          title: "🚀 Learning Boost Complete!",
          description: `Identified ${data.stats.criticalPatterns} critical patterns from ${data.stats.totalCorrections} corrections`,
        });
      } else {
        throw new Error(data?.error || 'Unknown error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to boost learning';
      setError(message);
      toast({
        title: "Boost Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5">
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/20">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Boost AI Learning</h3>
              <p className="text-sm text-muted-foreground">
                Analyze all saved results and extract learning patterns immediately
              </p>
            </div>
          </div>

          <Button 
            onClick={handleBoost} 
            disabled={isLoading}
            className="gap-2"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4" />
                Boost Now
              </>
            )}
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
          </div>
        )}

        {/* Success Stats Display */}
        {lastBoost && !error && (
          <div className="mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/20 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="font-medium text-green-600 dark:text-green-400">
                Learning Boost Complete!
              </span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="p-2 rounded bg-background/50">
                <div className="text-muted-foreground">Corrections Analyzed</div>
                <div className="font-bold text-foreground">{lastBoost.totalCorrections}</div>
              </div>
              <div className="p-2 rounded bg-background/50">
                <div className="text-muted-foreground">Passed Locally</div>
                <div className="font-bold text-foreground">{lastBoost.totalPassedLocally}</div>
              </div>
              <div className="p-2 rounded bg-background/50">
                <div className="text-muted-foreground">Manual Fixes</div>
                <div className="font-bold text-foreground">{lastBoost.totalManualFixes}</div>
              </div>
              <div className="p-2 rounded bg-background/50">
                <div className="text-muted-foreground">Unique Patterns</div>
                <div className="font-bold text-foreground">{lastBoost.uniquePatterns}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge className={cn(
                "text-xs",
                lastBoost.criticalPatterns > 0 ? "bg-red-500/20 text-red-600 dark:text-red-400" : "bg-muted text-muted-foreground"
              )}>
                {lastBoost.criticalPatterns} Critical (5+ times)
              </Badge>
              <Badge className={cn(
                "text-xs",
                lastBoost.highPatterns > 0 ? "bg-orange-500/20 text-orange-600 dark:text-orange-400" : "bg-muted text-muted-foreground"
              )}>
                {lastBoost.highPatterns} High (3-4 times)
              </Badge>
              <Badge className="text-xs bg-muted text-muted-foreground">
                {lastBoost.normalPatterns} Normal (1-2 times)
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground">
              Next analysis will use these {lastBoost.uniquePatterns} patterns to improve accuracy.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
