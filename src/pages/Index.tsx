import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ErrorPatternChips } from '@/components/ErrorPatternChips';
import { groupFailuresByPattern, getBucketKeyForMessage } from '@/lib/errorPatternGrouping';
import { Link } from 'react-router-dom';
import { useChecklist } from '@/hooks/useChecklist';
import { useFeedback } from '@/hooks/useFeedback';
import { useSessionPersistence } from '@/hooks/useSessionPersistence';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Upload, Zap, Trash2, CalendarIcon, FileText, ClipboardList, BarChart3, Settings as SettingsIcon, Search, Filter, CheckCircle, BookOpen, SearchCheck, CircleSlash, Target, Bug, Rocket, Info, RotateCcw, X, ListChecks } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AppLogo } from '@/components/AppLogo';
import { cn } from '@/lib/utils';
import { aiRecommendedInvestigate } from '@/lib/aiInvestigateRecommendation';
import { format } from 'date-fns';
import { LearningModeCard } from '@/components/LearningModeCard';
import { ProductionModeCard } from '@/components/ProductionModeCard';
import { Progress } from '@/components/ui/progress';
import { ReviewProgress } from '@/components/ReviewProgress';
import { FeedbackSummaryDialog } from '@/components/FeedbackSummaryDialog';
import { BulkActionPanel } from '@/components/BulkActionPanel';
import { toast } from 'sonner';
import { RunDetails, UserFeedback } from '@/types/feedback';
import { Classification, SortOption } from '@/types/testim';
import { useRegressionBuckets } from '@/hooks/useRegressionBuckets';

const Index = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sortOption, setSortOption] = useState<SortOption>('original');
  const [showRestoreBanner, setShowRestoreBanner] = useState(false);
  
  const {
    failures,
    getSortedFailures,
    stats,
    isLoading,
    isAnalyzing,
    analysisProgress,
    error,
    isPreClassifiedMode,
    preClassifiedStats,
    reportMode,
    uploadFailures,
    analyzeFailures,
    clearFailures,
    restoreSession,
    hasSessionToRestore,
  } = useChecklist();

  const { buckets, isLoading: bucketsLoading } = useRegressionBuckets();

  // Get sorted failures based on current sort option
  const sortedFailures = getSortedFailures(sortOption);
  const {
    failuresWithFeedback,
    summary,
    isReviewComplete,
    isSaving,
    saveError,
    initializeFeedback,
    handleFeedback,
    handleBulkFeedback,
    saveReport,
    resetFeedback,
    restoreFeedbackSession,
  } = useFeedback(failures, reportMode);
  
  const { saveRunDetails, loadRunDetails, clearAllSessions, hasExistingSession } = useSessionPersistence();
  
  const [dragOver, setDragOver] = useState(false);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [runDetails, setRunDetails] = useState<RunDetails>({
    name: '',
    date: new Date(),
    notes: '',
    isFeatureRollout: false
  });

  // Escape key exits bulk mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && bulkMode) {
        setBulkMode(false);
        setSelectedIds(new Set());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bulkMode]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const analyzedIds = sortedFailures.filter(f => f.analysis).map(f => f.id);
    setSelectedIds(new Set(analyzedIds));
  }, [sortedFailures]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);


  const handleBulkAction = useCallback((ids: string[], feedback: UserFeedback) => {
    handleBulkFeedback(ids, feedback);
    toast.success(`Applied action to ${ids.length} items`);
  }, [handleBulkFeedback]);

  // Check for existing session on mount
  useEffect(() => {
    if (hasExistingSession() && failures.length === 0) {
      setShowRestoreBanner(true);
    }
  }, [hasExistingSession, failures.length]);

  // Auto-save run details whenever they change
  useEffect(() => {
    if (runDetails.name || runDetails.notes) {
      saveRunDetails(runDetails);
    }
  }, [runDetails, saveRunDetails]);

  // Handle session restoration
  const handleRestoreSession = () => {
    const restoredAnalysis = restoreSession();
    const restoredFeedback = restoreFeedbackSession();
    const savedRunDetails = loadRunDetails();
    
    if (savedRunDetails) {
      setRunDetails(savedRunDetails);
    }
    
    if (restoredAnalysis || restoredFeedback) {
      toast.success('Previous work restored successfully');
    }
    setShowRestoreBanner(false);
  };

  // Handle starting fresh
  const handleStartFresh = () => {
    clearAllSessions();
    setShowRestoreBanner(false);
  };

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClassification, setFilterClassification] = useState<string>('all');
  const [filterReviewStatus, setFilterReviewStatus] = useState<'all' | 'reviewed' | 'unreviewed'>('all');
  const [filterPattern, setFilterPattern] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // "/" focuses search input — skip when user is typing in another field
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== '/') return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      e.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setFilterClassification('all');
    setFilterReviewStatus('all');
    setFilterPattern(null);
  }, []);

  const hasActiveFilters =
    !!searchQuery ||
    filterClassification !== 'all' ||
    filterReviewStatus !== 'all' ||
    filterPattern !== null;
  const classifications: Classification[] = ['Potential bug', 'Likely Flaky', 'Environment / Infra Issue', 'Expected Change', 'Investigate'];

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => uploadFailures(e.target?.result as string);
    reader.readAsText(file);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.csv')) handleFileUpload(file);
  };
  const handleClearAll = () => {
    clearFailures();
    resetFeedback();
    clearAllSessions();
    // Reset file input to allow re-uploading the same file
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  const handleCompleteReview = () => {
    setShowSummaryDialog(true);
  };
  const handleSaveReport = async () => {
    const success = await saveReport(runDetails);
    if (success) {
      toast.success('Report saved! AI will learn from your feedback.');
      setShowSummaryDialog(false);
      // Clear session storage after successful save
      clearAllSessions();
      handleClearAll();
    } else {
      toast.error(saveError || 'Failed to save report');
    }
  };
  const handleDiscardReport = () => {
    setShowSummaryDialog(false);
    toast.info('Report discarded');
  };
  const classColors: Record<string, string> = {
    'Potential bug': 'bg-bug text-bug-foreground',
    'Likely Flaky': 'bg-flaky text-flaky-foreground',
    'Environment / Infra Issue': 'bg-environment text-environment-foreground',
    'Expected Change': 'bg-expected text-expected-foreground',
    'Investigate': 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
  };
  const priorityColors: Record<string, string> = {
    P0: 'bg-p0',
    P1: 'bg-p1',
    P2: 'bg-p2',
    P3: 'bg-p3'
  };
  const hasAnalyzedResults = failures.length > 0 && (failuresWithFeedback.length > 0 || isAnalyzing);
  const analyzedCount = failuresWithFeedback.length;
  const reviewedCount = failuresWithFeedback.filter(f => f.isReviewed).length;

  // Recommendation stats (Investigate vs Skip)
  const recommendationStats = useMemo(() => {
    const analyzed = sortedFailures.filter(f => f.analysis);
    const investigate = analyzed.filter(f =>
      aiRecommendedInvestigate({
        classification: f.analysis?.classification,
        priority: f.analysis?.priority,
      }),
    );
    return {
      total: analyzed.length,
      investigate: investigate.length,
      skip: analyzed.length - investigate.length
    };
  }, [sortedFailures]);

  // Pattern groups: count from the SAME pool the filter applies to (analyzed rows
  // in sortedFailures), so a chip's count always equals the number of rows that
  // appear after clicking it.
  const analyzedSortedFailures = useMemo(
    () => sortedFailures.filter(f => !!f.analysis),
    [sortedFailures],
  );
  const patternGroups = useMemo(
    () => groupFailuresByPattern(analyzedSortedFailures),
    [analyzedSortedFailures],
  );
  const totalAnalyzedForChips = analyzedSortedFailures.length;

  // Set of bucket keys that earned a dedicated chip (count >= 2). Anything not
  // in this set is part of "Other" — including singletons of canonical buckets
  // and messages that didn't match any canonical bucket.
  const visibleBucketKeys = useMemo(
    () => new Set(patternGroups.filter(g => g.key !== '__other__').map(g => g.key)),
    [patternGroups],
  );

  // Filter: include analyzing rows; for analyzed rows apply search/classification/review/pattern
  const filteredFailures = useMemo(() => {
    return sortedFailures.filter(f => {
      if (!f.analysis) return true;
      const withFb = failuresWithFeedback.find(x => x.id === f.id);
      if (!withFb) return true;
      const matchesSearch = !searchQuery || f.testName.toLowerCase().includes(searchQuery.toLowerCase()) || (f.errorMessage?.toLowerCase() ?? '').includes(searchQuery.toLowerCase());
      const matchesClassification = filterClassification === 'all' || f.analysis?.classification === filterClassification;
      const matchesStatus = filterReviewStatus === 'all' || (filterReviewStatus === 'reviewed' && withFb.isReviewed) || (filterReviewStatus === 'unreviewed' && !withFb.isReviewed);
      const bucketKey = getBucketKeyForMessage(f.errorMessage);
      const matchesPattern =
        !filterPattern ||
        (filterPattern === '__other__'
          ? !visibleBucketKeys.has(bucketKey)
          : bucketKey === filterPattern);
      return matchesSearch && matchesClassification && matchesStatus && matchesPattern;
    });
  }, [sortedFailures, failuresWithFeedback, searchQuery, filterClassification, filterReviewStatus, filterPattern, visibleBucketKeys]);

  return <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Session Restore Banner */}
        {showRestoreBanner && (
          <Alert className="bg-amber-500/10 border-amber-500/30">
            <RotateCcw className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-600">You have unsaved work</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span className="text-muted-foreground">Previous work found. Would you like to continue where you left off?</span>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleRestoreSession} className="bg-amber-600 hover:bg-amber-700">
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Continue Work
                </Button>
                <Button size="sm" variant="outline" onClick={handleStartFresh}>
                  <X className="h-3 w-3 mr-1" />
                  Start Fresh
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Header */}
        <header className="text-center space-y-3 py-4 relative">
          <div className="absolute right-0 top-4 flex gap-2">
            <ThemeToggle />
            <Button asChild variant="outline" size="sm">
              <Link to="/reports">
                <FileText className="mr-2 h-4 w-4" />
                Reports
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/settings">
                <SettingsIcon className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard">
                <BarChart3 className="mr-2 h-4 w-4" />
                Dashboard
              </Link>
            </Button>
          </div>
          <div className="gap-3 flex items-center justify-start">
            <AppLogo size="lg" />
            <h1 className="text-3xl font-bold text-foreground tracking-tight">
              Testim.io Regression Failure Analyzer
            </h1>
          </div>
          
        </header>

        {/* Run Details Card */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardList className="h-5 w-5 text-primary" />
              Run Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Regression Bucket Dropdown */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Regression Bucket
                  <span className="text-destructive ml-1">*</span>
                </label>
                <Select 
                  value={runDetails.name} 
                  onValueChange={(val) => setRunDetails(prev => ({ ...prev, name: val }))}
                  disabled={bucketsLoading}
                >
                  <SelectTrigger className="bg-background/50">
                    <SelectValue placeholder={bucketsLoading ? "Loading buckets..." : "Select regression bucket"} />
                  </SelectTrigger>
                  <SelectContent className="bg-background border z-50">
                    {buckets.map((b) => (
                      <SelectItem key={b.id} value={b.name}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Picker */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal bg-background/50", !runDetails.date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {runDetails.date ? format(runDetails.date, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={runDetails.date} onSelect={date => date && setRunDetails(prev => ({
                    ...prev,
                    date
                  }))} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Notes (optional)</label>
              <Textarea placeholder="Add any relevant notes about this run... e.g., Weekly regression after release 2.5.0" value={runDetails.notes} onChange={e => setRunDetails(prev => ({
              ...prev,
              notes: e.target.value
            }))} className="bg-background/50 min-h-[80px] resize-none" />
            </div>

            {/* Feature Rollout Toggle */}
            <div className="flex items-center space-x-3 pt-2 border-t border-border/50">
              <Checkbox
                id="feature-rollout"
                checked={runDetails.isFeatureRollout}
                onCheckedChange={(checked) => 
                  setRunDetails(prev => ({ ...prev, isFeatureRollout: !!checked }))
                }
              />
              <div className="flex items-center gap-2">
                <label 
                  htmlFor="feature-rollout" 
                  className="text-sm font-medium text-foreground cursor-pointer flex items-center gap-2"
                >
                  <Rocket className="h-4 w-4 text-amber-500" />
                  Feature Rollout Run
                </label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[300px]">
                      <p>Check this if failures are expected due to a new feature rollout. QA feedback will still be saved for documentation, but will be excluded from AI learning.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              {runDetails.isFeatureRollout && (
                <span className="text-xs text-amber-600 bg-amber-500/10 px-2 py-1 rounded">
                  Excluded from AI learning
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upload Area */}
        <Card className={cn("border-2 border-dashed transition-all duration-200", dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/50")} onDragOver={e => {
        e.preventDefault();
        setDragOver(true);
      }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="p-4 rounded-full bg-muted/50">
              <Upload className="h-10 w-10 text-muted-foreground" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-foreground font-medium">Drop your failures CSV here</p>
              <p className="text-sm text-muted-foreground">Supports both regular CSV and pre-classified Testim exports</p>
            </div>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="mt-2">
              <FileText className="mr-2 h-4 w-4" />
              Select CSV File
            </Button>
          </CardContent>
        </Card>

        {/* Already-classified info banner */}
        {preClassifiedStats && <div className="bg-confidence-high/10 border border-confidence-high/30 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-confidence-high/20">
                <CheckCircle className="h-5 w-5 text-confidence-high" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">📋 Pre-classified file from Testim.io</p>
                <p className="text-sm text-muted-foreground mt-1">
                  <span className="text-confidence-high font-medium">{preClassifiedStats.classified}</span> failures already classified 
                  <span className="text-muted-foreground"> → will be marked as reviewed</span>
                  {preClassifiedStats.unclassified > 0 && <span> • <span className="text-flaky font-medium">{preClassifiedStats.unclassified}</span> unclassified 
                    <span className="text-muted-foreground"> → will be analyzed by AI</span></span>}
                  {preClassifiedStats.withBugLink > 0 && <span> • <span className="text-bug font-medium">{preClassifiedStats.withBugLink}</span> with bug link</span>}
                </p>
              </div>
            </div>
          </div>}

        {/* Mode Banner */}
        {failures.length > 0 && <Alert className={cn("border", reportMode === 'learning' ? "bg-primary/5 border-primary/30" : "bg-confidence-high/5 border-confidence-high/30")}>
            {reportMode === 'learning' ? <>
                <BookOpen className="h-4 w-4 text-primary" />
                <AlertTitle className="text-primary">Learning Mode</AlertTitle>
                <AlertDescription className="text-muted-foreground">
                  AI predictions will be compared against human classifications. This data trains the AI for better accuracy.
                </AlertDescription>
              </> : <>
                <Zap className="h-4 w-4 text-confidence-high" />
                <AlertTitle className="text-confidence-high">Guidance Mode — Should QA investigate?</AlertTitle>
                <AlertDescription className="text-muted-foreground space-y-1">
                  <p>Recommendations are based on previously classified QA decisions, known flaky tests, and similar historical patterns.</p>
                  <p className="text-xs italic">You are the final decision-maker.</p>
                </AlertDescription>
              </>}
          </Alert>}

        {error && <div className="bg-destructive/10 text-destructive p-4 rounded-lg border border-destructive/20">{error}</div>}

        {failures.length > 0 && <>
            {/* Run Info Banner */}
            {runDetails.name && <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">Run:</span>
                  <span className="font-semibold text-foreground">{runDetails.name}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-sm text-muted-foreground">{format(runDetails.date, "PPP")}</span>
                </div>
                {runDetails.notes && <span className="text-sm text-muted-foreground italic truncate max-w-[300px]">{runDetails.notes}</span>}
              </div>}

            {/* Stats - Recommendation based */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-border/50">
                <CardContent className="pt-4 text-center">
                  <div className="text-3xl font-bold text-foreground">{recommendationStats.total}</div>
                  <div className="text-sm text-muted-foreground mt-1">Total Analyzed</div>
                </CardContent>
              </Card>
              <Card className="border-bug/30 bg-bug/5">
                <CardContent className="pt-4 text-center">
                  <SearchCheck className="h-5 w-5 mx-auto text-bug mb-1" />
                  <div className="text-3xl font-bold text-bug">{recommendationStats.investigate}</div>
                  <div className="text-sm text-muted-foreground mt-1">Investigate</div>
                </CardContent>
              </Card>
              <Card className="border-flaky/30 bg-flaky/5">
                <CardContent className="pt-4 text-center">
                  <CircleSlash className="h-5 w-5 mx-auto text-flaky mb-1" />
                  <div className="text-3xl font-bold text-flaky">{recommendationStats.skip}</div>
                  <div className="text-sm text-muted-foreground mt-1">Skip</div>
                </CardContent>
              </Card>
              <Card className="border-confidence-high/30 bg-confidence-high/5">
                <CardContent className="pt-4 text-center">
                  <Target className="h-5 w-5 mx-auto text-confidence-high mb-1" />
                  <div className="text-3xl font-bold text-confidence-high">
                    {summary.reviewedCount > 0 ? `${summary.accuracyPercentage.toFixed(0)}%` : '—'}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">AI Accuracy</div>
                </CardContent>
              </Card>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <Button 
                  onClick={() => analyzeFailures(runDetails.name)} 
                  disabled={isAnalyzing || !runDetails.name} 
                  size="lg" 
                  className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
                >
                  <Zap className="mr-2 h-5 w-5" />
                  {isAnalyzing
                    ? (analysisProgress ? `Analyzing... ${analysisProgress.completed}/${analysisProgress.total}` : 'Analyzing...')
                    : 'Analyze with AI'}
                </Button>
                <Button variant="outline" onClick={handleClearAll} size="lg" disabled={isAnalyzing}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear All
                </Button>
              </div>
              {/* Analysis progress bar: table fills up in real time as each row completes */}
              {isAnalyzing && analysisProgress && analysisProgress.total > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Analyzed rows</span>
                    <span>{analysisProgress.completed} / {analysisProgress.total}</span>
                  </div>
                  <Progress
                    value={(analysisProgress.completed / analysisProgress.total) * 100}
                    className="h-2"
                  />
                </div>
              )}
            </div>

            {/* Review Progress Bar: X = reviewed (user action), Y = analyzed (grows as AI completes) */}
            {hasAnalyzedResults && <ReviewProgress reviewed={reviewedCount} total={analyzedCount} onComplete={handleCompleteReview} />}

            {/* Search and Filters — sticky so it stays accessible while scrolling the list */}
            {hasAnalyzedResults && <div className="sticky top-0 z-20 -mx-2 px-2 py-2 bg-background/85 backdrop-blur-md">
              <Card className="border-border/50 bg-card/80">
                <CardContent className="p-4 space-y-3">
                  {/* Pattern chips: auto-detected error categories */}
                  {patternGroups.length > 0 && (
                    <ErrorPatternChips
                      groups={patternGroups}
                      totalCount={totalAnalyzedForChips}
                      activePattern={filterPattern}
                      onSelect={setFilterPattern}
                    />
                  )}

                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Search Input */}
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        ref={searchInputRef}
                        placeholder="Search by test name or error message…  (press / to focus)"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-9 bg-background/50"
                      />
                    </div>

                    {/* Classification Filter */}
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <Select value={filterClassification} onValueChange={setFilterClassification}>
                        <SelectTrigger className="w-[180px] bg-background/50">
                          <SelectValue placeholder="All Classifications" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Classifications</SelectItem>
                          {classifications.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Sort Options */}
                    <div className="flex items-center gap-2">
                      <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
                        <SelectTrigger className="w-[180px] bg-background/50">
                          <SelectValue placeholder="Sort by..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="original">📄 Original Order</SelectItem>
                          <SelectItem value="priority">🔥 Priority (P0→P3)</SelectItem>
                          <SelectItem value="confidence">📊 AI Confidence</SelectItem>
                          <SelectItem value="testName">🔤 Test Name (A-Z)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Review Status Toggle */}
                    <ToggleGroup type="single" value={filterReviewStatus} onValueChange={v => v && setFilterReviewStatus(v as 'all' | 'reviewed' | 'unreviewed')} className="bg-background/50 rounded-md p-1">
                      <ToggleGroupItem value="all" className="text-xs px-3">All</ToggleGroupItem>
                      <ToggleGroupItem value="reviewed" className="text-xs px-3">Reviewed</ToggleGroupItem>
                      <ToggleGroupItem value="unreviewed" className="text-xs px-3">Unreviewed</ToggleGroupItem>
                    </ToggleGroup>

                    {/* Bulk Select Toggle */}
                    <Button
                      size="sm"
                      variant={bulkMode ? "default" : "outline"}
                      onClick={() => {
                        setBulkMode(prev => !prev);
                        if (bulkMode) setSelectedIds(new Set());
                      }}
                    >
                      <ListChecks className="h-4 w-4 mr-1" />
                      {bulkMode ? 'Exit Select' : 'Select Multiple'}
                    </Button>
                  </div>

                  {/* Bulk select actions row */}
                  {bulkMode && (
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={handleSelectAll}>Select All</Button>
                      <Button size="sm" variant="ghost" onClick={handleDeselectAll}>Deselect All</Button>
                      <span className="text-xs text-muted-foreground ml-2">{selectedIds.size} selected</span>
                    </div>
                  )}

                  {/* Results count + active filter breakdown + clear */}
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Showing <span className="font-medium text-foreground">{filteredFailures.length}</span> of {sortedFailures.length} rows
                    </span>
                    {hasActiveFilters && (
                      <>
                        <span className="text-muted-foreground/60">·</span>
                        <span>filtered by:</span>
                        {filterPattern && <span className="px-1.5 py-0.5 rounded bg-muted text-foreground max-w-[260px] truncate inline-block align-bottom">{patternGroups.find(g => g.key === filterPattern)?.label ?? filterPattern}</span>}
                        {filterClassification !== 'all' && <span className="px-1.5 py-0.5 rounded bg-muted text-foreground">{filterClassification}</span>}
                        {filterReviewStatus !== 'all' && <span className="px-1.5 py-0.5 rounded bg-muted text-foreground">{filterReviewStatus}</span>}
                        {searchQuery && <span className="px-1.5 py-0.5 rounded bg-muted text-foreground">"{searchQuery}"</span>}
                        <button
                          type="button"
                          onClick={handleClearFilters}
                          className="ml-1 inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <X className="h-3 w-3" />
                          Clear filters
                        </button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>}

            {/* Empty filter state */}
            {hasAnalyzedResults && filteredFailures.length === 0 && hasActiveFilters && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                  <Filter className="h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">No failures match the active filters.</p>
                  <Button size="sm" variant="outline" onClick={handleClearFilters}>
                    <X className="h-3 w-3 mr-1" />
                    Clear filters
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Results - scrollable list; Flex with gap-4 so cards don't shrink or hide */}
            <div className="overflow-y-auto min-h-0 flex flex-col gap-4">
              {filteredFailures.map(f => {
                if (f.analysis) {
                  const withFb = failuresWithFeedback.find(x => x.id === f.id) || { ...f, isReviewed: false as const };
                  return (
                    <div key={f.id} className="flex-shrink-0 flex items-start gap-3">
                      {bulkMode && (
                        <Checkbox
                          checked={selectedIds.has(f.id)}
                          onCheckedChange={() => toggleSelection(f.id)}
                          className="mt-5"
                        />
                      )}
                      <div className="flex-1">
                        {withFb.preClassified?.failureType ? (
                          <LearningModeCard failure={withFb} classColors={classColors} priorityColors={priorityColors} />
                        ) : (
                          <ProductionModeCard failure={withFb} onFeedback={handleFeedback} classColors={classColors} priorityColors={priorityColors} />
                        )}
                      </div>
                    </div>
                  );
                }
                return (
                  <Card key={f.id} className="flex-shrink-0 animate-fade-in border-border/50 hover:border-border transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-mono text-sm font-medium truncate text-foreground">{f.testName}</h3>
                          {f.errorMessage && <p className="text-xs text-muted-foreground mt-1 truncate">{f.errorMessage}</p>}
                        </div>
                        {f.isAnalyzing && <div className="animate-pulse text-muted-foreground text-sm">Analyzing...</div>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>}
      </div>

      {/* Feedback Summary Dialog */}
      <FeedbackSummaryDialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog} summary={summary} onSave={handleSaveReport} onDiscard={handleDiscardReport} isSaving={isSaving} />

      {/* Bulk Action Panel */}
      <BulkActionPanel
        selectedCount={selectedIds.size}
        selectedFailures={failuresWithFeedback.filter(f => selectedIds.has(f.id))}
        onBulkFeedback={handleBulkAction}
        onClearSelection={() => { setSelectedIds(new Set()); setBulkMode(false); }}
      />
    </div>;
};
export default Index;