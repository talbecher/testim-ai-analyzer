import { cn } from '@/lib/utils';
import type { PatternGroup, PatternColorTone } from '@/lib/errorPatternGrouping';

interface ErrorPatternChipsProps {
  groups: PatternGroup[];
  totalCount: number;
  activePattern: string | null;
  onSelect: (patternKey: string | null) => void;
}

const TONE_INACTIVE: Record<PatternColorTone, string> = {
  bug: 'border-bug/40 text-bug hover:bg-bug/10',
  flaky: 'border-flaky/40 text-flaky hover:bg-flaky/10',
  environment: 'border-environment/40 text-environment hover:bg-environment/10',
  expected: 'border-expected/40 text-expected hover:bg-expected/10',
  muted: 'border-border text-muted-foreground hover:bg-muted',
};

const TONE_ACTIVE: Record<PatternColorTone, string> = {
  bug: 'bg-bug/15 border-bug text-bug ring-2 ring-bug/30',
  flaky: 'bg-flaky/15 border-flaky text-flaky ring-2 ring-flaky/30',
  environment: 'bg-environment/15 border-environment text-environment ring-2 ring-environment/30',
  expected: 'bg-expected/15 border-expected text-expected ring-2 ring-expected/30',
  muted: 'bg-muted border-foreground/30 text-foreground ring-2 ring-foreground/20',
};

export const ErrorPatternChips = ({
  groups,
  totalCount,
  activePattern,
  onSelect,
}: ErrorPatternChipsProps) => {
  if (groups.length === 0) return null;

  const isAllActive = activePattern === null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground mr-1">Quick filters:</span>

      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium transition-all',
          isAllActive
            ? 'bg-primary/15 border-primary text-primary ring-2 ring-primary/30'
            : 'border-border text-muted-foreground hover:bg-muted',
        )}
        aria-pressed={isAllActive}
      >
        <span>All</span>
        <span className="font-mono tabular-nums opacity-70">· {totalCount}</span>
      </button>

      {groups.map((group) => {
        const isActive = activePattern === group.key;
        return (
          <button
            key={group.key}
            type="button"
            onClick={() => onSelect(isActive ? null : group.key)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium transition-all max-w-full',
              isActive ? TONE_ACTIVE[group.tone] : TONE_INACTIVE[group.tone],
            )}
            aria-pressed={isActive}
            title={`Filter by: ${group.label}`}
          >
            <span className="truncate max-w-[280px]">{group.label}</span>
            <span className="font-mono tabular-nums opacity-80 shrink-0">· {group.count}</span>
          </button>
        );
      })}
    </div>
  );
};
