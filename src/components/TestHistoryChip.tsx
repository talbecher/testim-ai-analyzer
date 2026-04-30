import { AlertTriangle, Info } from 'lucide-react';
import type { TestHistory, TestHistoryPattern, TestHistoryRunDetail } from '@/types/testim';
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

function runLabel(d: TestHistoryRunDetail | undefined, fallbackIdx: number): string {
  if (d?.runName) return d.runName;
  if (d?.runDate) return `Run ${d.runDate}`;
  return `Prior run #${fallbackIdx}`;
}

export interface TestHistoryChipProps {
  history: TestHistory;
  className?: string;
}

export function TestHistoryChip({ history, className }: TestHistoryChipProps) {
  const { pattern, lastNOutcomes, lastNRunDetails, totalRunsKnown, failedRuns } = history;

  // Use detailed data when available; fall back to outcomes-only.
  const detailsNewestFirst: TestHistoryRunDetail[] =
    lastNRunDetails && lastNRunDetails.length > 0
      ? lastNRunDetails
      : lastNOutcomes.map((o) => ({ outcome: o }));

  // Reverse to chronological (oldest → newest, LTR), then cap to last N visible.
  const chrono = [...detailsNewestFirst].reverse();
  const truncated = chrono.length > MAX_VISIBLE;
  const visible = truncated ? chrono.slice(-MAX_VISIBLE) : chrono;

  const showWarning = pattern === 'was-passing-now-failing';
  const headline = patternHeadline(pattern, history);
  const subline =
    totalRunsKnown > 0
      ? `Failed ${failedRuns} of ${totalRunsKnown} prior upload${totalRunsKnown === 1 ? '' : 's'}`
      : 'No prior uploads on record';

  return (
    <span
      dir="ltr"
      aria-label={headline}
      className={cn('inline-flex items-center gap-1.5 align-middle', className)}
    >
      {visible.length === 0 ? (
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded-[3px] bg-muted-foreground/30" />
          <span className="text-[10px] text-muted-foreground">first seen</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-[3px]">
          {truncated && (
            <span className="mr-0.5 text-[10px] leading-none text-muted-foreground">…</span>
          )}
          {visible.map((d, idx) => {
            const isCurrent = idx === visible.length - 1;
            const isPass = d.outcome === 'pass';
            const label = runLabel(d, chrono.length - visible.length + idx + 1);
            return (
              <Tooltip key={idx}>
                <TooltipTrigger asChild>
                  <span
                    className={cn(
                      'inline-block cursor-help transition-transform hover:scale-110',
                      isCurrent
                        ? 'h-3.5 w-3.5 rounded-[4px] ring-1 ring-foreground/30 ring-offset-1 ring-offset-background'
                        : 'h-3 w-3 rounded-[3px]',
                      isPass ? 'bg-confidence-high' : 'bg-bug',
                    )}
                  />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs space-y-0.5 text-xs" dir="ltr">
                  <p className="font-medium">{label}</p>
                  {isPass ? (
                    <p className="text-muted-foreground">
                      Passed — not in the failures CSV for this run
                    </p>
                  ) : (
                    <p className="text-muted-foreground">
                      Failed — classified as{' '}
                      <span className="font-medium text-foreground">
                        {d.aiClassification || 'unknown'}
                      </span>
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </span>
      )}

      {showWarning && (
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-hidden />
      )}

      {/* Summary tooltip — pattern, counts, chronological strip */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-help items-center">
            <Info className="h-3 w-3 text-muted-foreground/60" aria-hidden />
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs space-y-1 text-xs" dir="ltr">
          <p className="font-medium">{headline}</p>
          <p className="text-muted-foreground">{subline}</p>
          {chrono.length > 0 && (
            <p className="font-mono text-[11px] tracking-wider text-muted-foreground">
              {chrono.map((d) => (d.outcome === 'pass' ? '·' : '●')).join(' ')}
              <span className="ml-2 not-italic opacity-70">oldest → newest</span>
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}
