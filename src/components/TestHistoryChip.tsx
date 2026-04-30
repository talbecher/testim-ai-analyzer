import type { TestHistory, TestHistoryPattern } from '@/types/testim';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

function rowToEmoji(outcomes: ('pass' | 'fail')[]): string {
  return outcomes.map((o) => (o === 'pass' ? '✅' : '❌')).join('');
}

function chipCopy(pattern: TestHistoryPattern, h: TestHistory): { label: string; sub?: string } {
  const icons = rowToEmoji(h.lastNOutcomes);
  switch (pattern) {
    case 'was-passing-now-failing':
      return {
        label: icons ? `${icons}  pass → fail` : 'pass → fail',
        sub: 'regression smell',
      };
    case 'consistent-failure':
      return {
        label: `${h.currentFailStreak} fails in a row`,
        sub: 'consistent failure',
      };
    case 'intermittent':
      return {
        label: icons ? `${icons}  intermittent` : 'intermittent',
        sub: 'alternating outcomes',
      };
    case 'first-seen':
      return { label: '★ first seen', sub: 'no prior failures in DB' };
    default:
      return {
        label: icons ? `${icons}  mixed` : 'mixed history',
        sub: 'sporadic',
      };
  }
}

function chipStyles(pattern: TestHistoryPattern): string {
  switch (pattern) {
    case 'was-passing-now-failing':
      return 'bg-amber-500/15 text-amber-900 dark:text-amber-100 border-amber-500/40';
    case 'consistent-failure':
      return 'bg-destructive/15 text-destructive border-destructive/40';
    case 'intermittent':
      return 'bg-yellow-500/15 text-yellow-900 dark:text-yellow-100 border-yellow-500/40';
    case 'first-seen':
      return 'bg-muted text-muted-foreground border-border';
    default:
      return 'bg-muted/80 text-muted-foreground border-border/80';
  }
}

export interface TestHistoryChipProps {
  history: TestHistory;
  className?: string;
}

export function TestHistoryChip({ history, className }: TestHistoryChipProps) {
  const { pattern, lastNOutcomes } = history;
  const { label, sub } = chipCopy(pattern, history);
  const totalStrip = lastNOutcomes.length;
  const chronoEmoji =
    totalStrip > 0 ? rowToEmoji([...lastNOutcomes].reverse()) : '';
  const tooltipLine1 =
    totalStrip > 0
      ? `Last ${totalStrip} prior upload(s), oldest→newest: ${chronoEmoji}`
      : 'No prior uploads in the recent window';
  const tooltipLine2 =
    history.totalRunsKnown > 0
      ? `Failed ${history.failedRuns} of ${history.totalRunsKnown} prior uploads globally (implicit pass if not in failure list)`
      : 'First failure on record for this test name';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          dir="ltr"
          className={cn(
            'inline-flex max-w-[min(100%,14rem)] cursor-default items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] leading-tight',
            chipStyles(pattern),
            className,
          )}
        >
          <span className="truncate">{label}</span>
          {sub && <span className="hidden text-[9px] opacity-70 sm:inline">({sub})</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-xs" dir="ltr">
        <p className="font-medium">{tooltipLine1}</p>
        <p className="text-muted-foreground">{tooltipLine2}</p>
      </TooltipContent>
    </Tooltip>
  );
}
