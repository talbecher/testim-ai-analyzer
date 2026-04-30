import { AlertTriangle } from 'lucide-react';
import type { TestHistory, TestHistoryPattern } from '@/types/testim';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const MAX_VISIBLE = 8;

function patternHeadline(pattern: TestHistoryPattern, h: TestHistory): string {
  switch (pattern) {
    case 'was-passing-now-failing':
      return 'Regression smell — was passing, now failing';
    case 'consistent-failure':
      return `Consistent fail for last ${h.currentFailStreak} run${h.currentFailStreak === 1 ? '' : 's'}`;
    case 'intermittent':
      return 'Intermittent pattern — alternating outcomes';
    case 'first-seen':
      return 'First failure on record for this test';
    case 'sporadic-failure':
    default:
      return 'Sporadic failures across recent runs';
  }
}

export interface TestHistoryChipProps {
  history: TestHistory;
  className?: string;
}

export function TestHistoryChip({ history, className }: TestHistoryChipProps) {
  const { pattern, lastNOutcomes, totalRunsKnown, failedRuns } = history;

  // Reverse to chronological (oldest → newest, LTR), then cap to last N visible.
  const chrono = [...lastNOutcomes].reverse();
  const truncated = chrono.length > MAX_VISIBLE;
  const visible = truncated ? chrono.slice(-MAX_VISIBLE) : chrono;

  const showWarning = pattern === 'was-passing-now-failing';
  const headline = patternHeadline(pattern, history);
  const subline =
    totalRunsKnown > 0
      ? `Failed ${failedRuns} of ${totalRunsKnown} prior upload${totalRunsKnown === 1 ? '' : 's'}`
      : 'No prior uploads on record';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          dir="ltr"
          aria-label={headline}
          className={cn(
            'inline-flex cursor-default items-center align-middle',
            className,
          )}
        >
          {visible.length === 0 ? (
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-[2px] bg-muted-foreground/30" />
              <span className="text-[10px] text-muted-foreground">first seen</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-[2px]">
              {truncated && (
                <span className="mr-0.5 text-[10px] leading-none text-muted-foreground">…</span>
              )}
              {visible.map((outcome, idx) => {
                const isCurrent = idx === visible.length - 1;
                const isPass = outcome === 'pass';
                return (
                  <span
                    key={idx}
                    className={cn(
                      'inline-block transition-transform',
                      isCurrent
                        ? 'h-2.5 w-2.5 rounded-[3px] ring-1 ring-foreground/30 ring-offset-1 ring-offset-background'
                        : 'h-2 w-2 rounded-[2px]',
                      isPass ? 'bg-confidence-high' : 'bg-bug',
                    )}
                  />
                );
              })}
            </span>
          )}

          {showWarning && (
            <AlertTriangle
              className="ml-1 h-3 w-3 text-amber-500"
              aria-hidden
            />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs space-y-1 text-xs" dir="ltr">
        <p className="font-medium">{headline}</p>
        <p className="text-muted-foreground">{subline}</p>
        {chrono.length > 0 && (
          <p className="font-mono text-[11px] tracking-wider text-muted-foreground">
            {chrono.map((o) => (o === 'pass' ? '·' : '●')).join(' ')}
            <span className="ml-2 not-italic opacity-70">oldest → newest</span>
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
