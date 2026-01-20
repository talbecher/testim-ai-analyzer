import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, X, Link as LinkIcon, Bug, TestTube, MessageSquare, Wrench } from 'lucide-react';
import { useBugCategories } from '@/hooks/useBugCategories';
import { BugCategory } from '@/types/bugCategory';

interface BugConfirmationFlowProps {
  onConfirmBug: (category: string, bugLink?: string) => void;
  onPassedLocally: (reason: string, notes?: string) => void;
  onRequiredManualFix: (fixType: string, notes?: string) => void;
  onCancel: () => void;
}

export function BugConfirmationFlow({ onConfirmBug, onPassedLocally, onRequiredManualFix, onCancel }: BugConfirmationFlowProps) {
  const { fetchCategoriesByType, isLoading } = useBugCategories();
  const [step, setStep] = useState<'question' | 'category' | 'passed-reason' | 'manual-fix'>('question');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [bugLink, setBugLink] = useState('');
  const [passedReason, setPassedReason] = useState<string>('');
  const [passedNotes, setPassedNotes] = useState('');
  const [manualFixType, setManualFixType] = useState<string>('');
  const [manualFixNotes, setManualFixNotes] = useState('');

  // Separate state for each category type
  const [bugCategories, setBugCategories] = useState<BugCategory[]>([]);
  const [passedLocallyCategories, setPassedLocallyCategories] = useState<BugCategory[]>([]);
  const [manualFixCategories, setManualFixCategories] = useState<BugCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Load categories when step changes
  useEffect(() => {
    const loadCategories = async () => {
      setLoadingCategories(true);
      try {
        if (step === 'category' && bugCategories.length === 0) {
          const cats = await fetchCategoriesByType('bug');
          setBugCategories(cats);
        } else if (step === 'passed-reason' && passedLocallyCategories.length === 0) {
          const cats = await fetchCategoriesByType('passed_locally');
          setPassedLocallyCategories(cats);
        } else if (step === 'manual-fix' && manualFixCategories.length === 0) {
          const cats = await fetchCategoriesByType('manual_fix');
          setManualFixCategories(cats);
        }
      } catch (error) {
        console.error('Failed to load categories:', error);
      }
      setLoadingCategories(false);
    };
    loadCategories();
  }, [step, fetchCategoriesByType, bugCategories.length, passedLocallyCategories.length, manualFixCategories.length]);

  const handleYesBug = () => {
    setStep('category');
  };

  const handleNoBug = () => {
    setStep('passed-reason');
  };

  const handleManualFix = () => {
    setStep('manual-fix');
  };

  const handleConfirmCategory = () => {
    if (selectedCategory) {
      onConfirmBug(selectedCategory, bugLink || undefined);
    }
  };

  const handleConfirmPassedLocally = () => {
    if (passedReason) {
      onPassedLocally(passedReason, passedNotes || undefined);
    }
  };

  const handleConfirmManualFix = () => {
    if (manualFixType) {
      onRequiredManualFix(manualFixType, manualFixNotes || undefined);
    }
  };

  if (step === 'question') {
    return (
      <div className="space-y-3 animate-fade-in">
        <div className="text-sm font-medium text-foreground">Was there actually a bug?</div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="h-8 text-xs bg-bug hover:bg-bug/90 text-bug-foreground"
            onClick={handleYesBug}
          >
            <Bug className="h-3 w-3 mr-1" />
            Yes, it was a bug
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs bg-confidence-high/10 hover:bg-confidence-high/20 text-confidence-high border-confidence-high/30"
            onClick={handleNoBug}
          >
            <TestTube className="h-3 w-3 mr-1" />
            No, passed locally
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border-amber-500/30"
            onClick={handleManualFix}
          >
            <Wrench className="h-3 w-3 mr-1" />
            Required manual fix
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'manual-fix') {
    return (
      <div className="space-y-3 animate-fade-in">
        <div className="text-sm font-medium text-foreground">What type of manual fix was required?</div>
        <div className="grid gap-2">
          <Select value={manualFixType} onValueChange={setManualFixType}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={loadingCategories ? "Loading..." : "Select fix type..."} />
            </SelectTrigger>
            <SelectContent>
              {manualFixCategories.map(cat => (
                <SelectItem key={cat.id} value={cat.name} className="text-xs">
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-start gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground mt-2" />
            <Textarea
              placeholder="Additional notes for AI learning (optional)"
              value={manualFixNotes}
              onChange={(e) => setManualFixNotes(e.target.value)}
              className="text-xs flex-1 min-h-[60px] resize-none"
            />
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleConfirmManualFix}
              disabled={!manualFixType}
            >
              <Check className="h-3 w-3 mr-1" />
              Confirm
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setStep('question')}
            >
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'passed-reason') {
    return (
      <div className="space-y-3 animate-fade-in">
        <div className="text-sm font-medium text-foreground">Why did this test pass locally?</div>
        <div className="grid gap-2">
          <Select value={passedReason} onValueChange={setPassedReason}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={loadingCategories ? "Loading..." : "Select reason..."} />
            </SelectTrigger>
            <SelectContent>
              {passedLocallyCategories.map(cat => (
                <SelectItem key={cat.id} value={cat.name} className="text-xs">
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-start gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground mt-2" />
            <Textarea
              placeholder="Additional notes for AI learning (optional)"
              value={passedNotes}
              onChange={(e) => setPassedNotes(e.target.value)}
              className="text-xs flex-1 min-h-[60px] resize-none"
            />
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleConfirmPassedLocally}
              disabled={!passedReason}
            >
              <Check className="h-3 w-3 mr-1" />
              Confirm
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setStep('question')}
            >
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="text-sm font-medium text-foreground">Select bug category:</div>
      <div className="grid gap-2">
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder={loadingCategories ? "Loading..." : "Select category..."} />
          </SelectTrigger>
          <SelectContent>
            {bugCategories.map(cat => (
              <SelectItem key={cat.id} value={cat.name} className="text-xs">
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <LinkIcon className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Bug link (optional)"
            value={bugLink}
            onChange={(e) => setBugLink(e.target.value)}
            className="h-8 text-xs flex-1"
          />
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={handleConfirmCategory}
            disabled={!selectedCategory}
          >
            <Check className="h-3 w-3 mr-1" />
            Confirm
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setStep('question')}
          >
            Back
          </Button>
        </div>
      </div>
    </div>
  );
}
