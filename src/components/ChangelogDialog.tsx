import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus, Wrench, RefreshCw, Trash2 } from 'lucide-react';
import { CHANGELOG, ChangelogEntry } from '@/version';

interface ChangelogSectionProps {
  title: string;
  items?: string[];
  icon: React.ReactNode;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
}

function ChangelogSection({ title, items, icon, variant }: ChangelogSectionProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-medium text-sm">{title}</span>
      </div>
      <ul className="space-y-1 ml-6">
        {items.map((item, index) => (
          <li key={index} className="text-sm text-muted-foreground list-disc">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function VersionEntry({ entry }: { entry: ChangelogEntry }) {
  return (
    <div className="border-b border-border/50 pb-4 last:border-0">
      <div className="flex items-center gap-3 mb-3">
        <Badge variant="outline" className="font-mono">
          v{entry.version}
        </Badge>
        <span className="text-sm text-muted-foreground">{entry.date}</span>
      </div>
      
      <div className="space-y-3">
        <ChangelogSection
          title="Added"
          items={entry.added}
          icon={<Plus className="h-4 w-4 text-green-500" />}
          variant="default"
        />
        <ChangelogSection
          title="Fixed"
          items={entry.fixed}
          icon={<Wrench className="h-4 w-4 text-blue-500" />}
          variant="secondary"
        />
        <ChangelogSection
          title="Changed"
          items={entry.changed}
          icon={<RefreshCw className="h-4 w-4 text-amber-500" />}
          variant="outline"
        />
        <ChangelogSection
          title="Removed"
          items={entry.removed}
          icon={<Trash2 className="h-4 w-4 text-destructive" />}
          variant="destructive"
        />
      </div>
    </div>
  );
}

interface ChangelogDialogProps {
  children: React.ReactNode;
}

export function ChangelogDialog({ children }: ChangelogDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Changelog
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            {CHANGELOG.map((entry) => (
              <VersionEntry key={entry.version} entry={entry} />
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
