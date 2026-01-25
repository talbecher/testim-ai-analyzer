import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SignalBreakdownData } from '@/types/testim';

interface SignalBreakdownBarProps {
  breakdown: SignalBreakdownData;
  showLabels?: boolean;
  className?: string;
}

export function SignalBreakdownBar({ breakdown, showLabels = false, className }: SignalBreakdownBarProps) {
  const { bugScore, flakyScore, environmentScore, investigateScore, activeSignals } = breakdown;
  
  // Only show if there are actual scores
  const hasScores = bugScore + flakyScore + environmentScore + investigateScore > 0;
  if (!hasScores) return null;

  const segments = [
    { score: bugScore, label: 'Bug', color: 'bg-bug', textColor: 'text-bug' },
    { score: flakyScore, label: 'Flaky', color: 'bg-amber-500', textColor: 'text-amber-500' },
    { score: environmentScore, label: 'Env', color: 'bg-environment', textColor: 'text-environment' },
    { score: investigateScore, label: 'Investigate', color: 'bg-purple-500', textColor: 'text-purple-500' },
  ].filter(s => s.score > 0);

  return (
    <TooltipProvider>
      <div className={cn("space-y-1", className)}>
        {/* Bar */}
        <div className="flex h-2 rounded-full overflow-hidden bg-muted/30">
          {segments.map((segment, idx) => (
            <Tooltip key={segment.label}>
              <TooltipTrigger asChild>
                <div
                  className={cn(segment.color, "transition-all duration-300")}
                  style={{ width: `${segment.score}%` }}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p className="font-medium">{segment.label}: {segment.score}%</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Labels */}
        {showLabels && (
          <div className="flex gap-3 text-xs">
            {segments.map(segment => (
              <div key={segment.label} className={cn("flex items-center gap-1", segment.textColor)}>
                <div className={cn("w-2 h-2 rounded-full", segment.color)} />
                <span>{segment.label}</span>
                <span className="text-muted-foreground">({segment.score}%)</span>
              </div>
            ))}
          </div>
        )}

        {/* Active signals (collapsed by default) */}
        {activeSignals.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">Signals:</span>{' '}
            {activeSignals.slice(0, 4).map(s => 
              s.replace(/_/g, ' ').toLowerCase()
            ).join(', ')}
            {activeSignals.length > 4 && ` +${activeSignals.length - 4} more`}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

/**
 * Compact version for inline display
 */
export function SignalBreakdownCompact({ breakdown }: { breakdown: SignalBreakdownData }) {
  const { bugScore, flakyScore, environmentScore, investigateScore } = breakdown;
  
  const hasScores = bugScore + flakyScore + environmentScore + investigateScore > 0;
  if (!hasScores) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex h-1.5 w-16 rounded-full overflow-hidden bg-muted/30 cursor-help">
            {bugScore > 0 && (
              <div className="bg-bug" style={{ width: `${bugScore}%` }} />
            )}
            {flakyScore > 0 && (
              <div className="bg-amber-500" style={{ width: `${flakyScore}%` }} />
            )}
            {environmentScore > 0 && (
              <div className="bg-environment" style={{ width: `${environmentScore}%` }} />
            )}
            {investigateScore > 0 && (
              <div className="bg-purple-500" style={{ width: `${investigateScore}%` }} />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs space-y-1">
          <p className="font-medium">Signal Breakdown</p>
          {bugScore > 0 && <p className="text-bug">Bug: {bugScore}%</p>}
          {flakyScore > 0 && <p className="text-amber-500">Flaky: {flakyScore}%</p>}
          {environmentScore > 0 && <p className="text-environment">Env: {environmentScore}%</p>}
          {investigateScore > 0 && <p className="text-purple-500">Investigate: {investigateScore}%</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
