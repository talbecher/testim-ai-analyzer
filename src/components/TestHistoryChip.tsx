import { AlertTriangle, Info } from 'lucide-react';
import type { TestHistory, TestHistoryPattern, TestHistoryRunDetail } from '@/types/testim';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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

function formatDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  // Expecting YYYY-MM-DD; fall back to raw if parsing fails.
  const d = new Date(`${iso}T12:00:00Z`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export interface TestHistoryChipProps {
  history: TestHistory;
  className?: string;
}

export function TestHistoryChip({ history, className }: TestHistoryChipProps) {
  const { pattern, lastNOutcomes, lastNRunDetails, totalRunsKnown, failedRuns } = history;

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
    // Local provider — overrides the app-wide 700ms delay so per-square hover feels instant
    // and avoids collisions with the summary tooltip.
    <TooltipProvider delayDuration={120} skipDelayDuration={300}>
      <span
        dir="ltr"
        aria-label={headline}
        className={cn('inline-flex items-center gap-1.5 align-middle', className)}
      >
        {visible.length === 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help items-center gap-1">
                <span className="h-4 w-4 rounded-[4px] bg-muted-foreground/30" />
                <span className="text-[10px] text-muted-foreground">first seen</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs space-y-1 text-xs" dir="ltr">
              <p className="font-medium">{headline}</p>
              <p className="text-muted-foreground">
                No prior record of this test in this regression bucket.
              </p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="inline-flex items-center gap-1">
            {truncated && (
              <span className="mr-0.5 text-[10px] leading-none text-muted-foreground">…</span>
            )}
            {visible.map((d, idx) => {
              const isCurrent = idx === visible.length - 1;
              const isPass = d.outcome === 'pass';
              const label = runLabel(d, chrono.length - visible.length + idx + 1);
              const dateStr = formatDate(d.runDate);
              return (
                <Tooltip key={idx}>
                  <TooltipTrigger asChild>
                    {/* Wrapper expands the hit area without changing the visible square size */}
                    <span className="inline-flex cursor-help items-center justify-center p-1 -m-1">
                      <span
                        className={cn(
                          'inline-block transition-transform hover:scale-110',
                          isCurrent
                            ? 'h-[18px] w-[18px] rounded-[5px] ring-1 ring-foreground/30 ring-offset-1 ring-offset-background'
                            : 'h-4 w-4 rounded-[4px]',
                          isPass ? 'bg-confidence-high' : 'bg-bug',
                        )}
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    className="max-w-xs space-y-1 text-xs"
                    dir="ltr"
                  >
                    <p className="font-medium">
                      {label}
                      {isCurrent && (
                        <span className="ml-1 text-muted-foreground">(current run)</span>
                      )}
                    </p>
                    <div className="space-y-0.5 text-muted-foreground">
                      {dateStr && (
                        <p>
                          <span className="text-foreground/70">Date:</span> {dateStr}
                        </p>
                      )}
                      {d.bucket && (
                        <p>
                          <span className="text-foreground/70">Bucket:</span> {d.bucket}
                        </p>
                      )}
                      <p>
                        <span className="text-foreground/70">Outcome:</span>{' '}
                        {isPass ? (
                          <span className="text-foreground">
                            Passed — not in failures CSV
                          </span>
                        ) : (
                          <span className="text-foreground">Failed</span>
                        )}
                      </p>
                      {!isPass && (
                        <>
                          <p>
                            <span className="text-foreground/70">AI classified as:</span>{' '}
                            <span className="font-medium text-foreground">
                              {d.aiClassification || 'unknown'}
                            </span>
                          </p>
                          {d.aiPriority && (
                            <p>
                              <span className="text-foreground/70">AI priority:</span>{' '}
                              <span className="font-medium text-foreground">{d.aiPriority}</span>
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </span>
        )}

        {showWarning && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help items-center">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-hidden />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs space-y-1 text-xs" dir="ltr">
              <p className="font-medium">{headline}</p>
              <p className="text-muted-foreground">{subline}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Summary tooltip on a small info icon — always last, never overlaps the squares */}
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
            <p className="text-[10px] italic text-muted-foreground/80">
              Scoped to this regression bucket
            </p>
          </TooltipContent>
        </Tooltip>
      </span>
    </TooltipProvider>
  );
}
