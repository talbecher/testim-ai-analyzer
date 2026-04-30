import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { splitPriorityReasonForToggle } from '@/lib/priorityReasonToggle';
import { cn } from '@/lib/utils';

export interface PriorityReasonToggleProps {
  text: string;
  className?: string;
}

export function PriorityReasonToggle({ text, className }: PriorityReasonToggleProps) {
  const { first, rest } = useMemo(() => splitPriorityReasonForToggle(text), [text]);
  const [expanded, setExpanded] = useState(false);

  if (!first) return null;

  const hasMore = rest.length > 0;

  return (
    <div className={cn('text-xs text-muted-foreground mt-2', className)}>
      <p className="whitespace-pre-line">{expanded ? text.replace(/\r\n/g, '\n').trim() : first}</p>
      {hasMore && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1 h-6 px-1.5 text-xs font-normal text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? 'Show less' : 'Show more'}
        </Button>
      )}
    </div>
  );
}
