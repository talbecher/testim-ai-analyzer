import { useState, useRef, useEffect, useMemo } from 'react';
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
import { Upload, Zap, Trash2, CalendarIcon, FileText, ClipboardList, BarChart3, Settings as SettingsIcon, Search, Filter, CheckCircle, BookOpen, SearchCheck, CircleSlash, Target, Bug, Rocket, Info, RotateCcw, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { LearningModeCard } from '@/components/LearningModeCard';
import { ProductionModeCard } from '@/components/ProductionModeCard';
import { ReviewProgress } from '@/components/ReviewProgress';
import { FeedbackSummaryDialog } from '@/components/FeedbackSummaryDialog';
import { toast } from 'sonner';
import { RunDetails } from '@/types/feedback';
import { Classification, SortOption } from '@/types/testim';

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
    saveReport,
    resetFeedback,
    restoreFeedbackSession,
  } = useFeedback(failures, reportMode);
  
  const { saveRunDetails, loadRunDetails, clearAllSessions, hasExistingSession } = useSessionPersistence();
  
  const [dragOver, setDragOver] = useState(false);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [runDetails, setRunDetails] = useState<RunDetails>({
    name: '',
    date: new Date(),
    notes: '',
    isFeatureRollout: false
  });

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
      toast.success('עבודה קודמת שוחזרה בהצלחה');
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
  const classifications: Classification[] = ['Potential bug', 'Likely Flaky', 'Environment / Infra Issue', 'Expected Change'];

  // Initialize feedback when analysis completes
  useEffect(() => {
    const analyzedFailures = sortedFailures.filter(f => f.analysis);
    if (analyzedFailures.length > 0 && failuresWithFeedback.length === 0) {
      initializeFeedback(analyzedFailures);
    }
  }, [sortedFailures, initializeFeedback, failuresWithFeedback.length]);
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
    'Expected Change': 'bg-expected text-expected-foreground'
  };
  const priorityColors: Record<string, string> = {
    P0: 'bg-p0',
    P1: 'bg-p1',
    P2: 'bg-p2',
    P3: 'bg-p3'
  };
  const hasAnalyzedResults = failuresWithFeedback.length > 0;
  const reviewedCount = failuresWithFeedback.filter(f => f.isReviewed).length;

  // Recommendation stats (Investigate vs Skip)
  const recommendationStats = useMemo(() => {
    const analyzed = sortedFailures.filter(f => f.analysis);
    const investigate = analyzed.filter(f => f.analysis?.classification === 'Potential bug' || f.analysis?.priority === 'P0' || f.analysis?.priority === 'P1');
    return {
      total: analyzed.length,
      investigate: investigate.length,
      skip: analyzed.length - investigate.length
    };
  }, [sortedFailures]);

  // Filter failures based on search and filters
  const filteredFailures = useMemo(() => {
    return failuresWithFeedback.filter(f => {
      const matchesSearch = !searchQuery || f.testName.toLowerCase().includes(searchQuery.toLowerCase()) || f.errorMessage?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesClassification = filterClassification === 'all' || f.analysis?.classification === filterClassification;
      const matchesStatus = filterReviewStatus === 'all' || filterReviewStatus === 'reviewed' && f.isReviewed || filterReviewStatus === 'unreviewed' && !f.isReviewed;
      return matchesSearch && matchesClassification && matchesStatus;
    });
  }, [failuresWithFeedback, searchQuery, filterClassification, filterReviewStatus]);
  return <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Session Restore Banner */}
        {showRestoreBanner && (
          <Alert className="bg-amber-500/10 border-amber-500/30">
            <RotateCcw className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-600">יש לך עבודה שלא נשמרה</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span className="text-muted-foreground">נמצאה עבודה קודמת. האם להמשיך מאיפה שהפסקת?</span>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleRestoreSession} className="bg-amber-600 hover:bg-amber-700">
                  <RotateCcw className="h-3 w-3 mr-1" />
                  המשך עבודה
                </Button>
                <Button size="sm" variant="outline" onClick={handleStartFresh}>
                  <X className="h-3 w-3 mr-1" />
                  התחל מחדש
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
            <div className="p-2 rounded-lg bg-primary/10">
              <Bug className="h-8 w-8 text-primary" />
            </div>
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
              {/* Run Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Run Name</label>
                <Input placeholder="e.g., Regression 1, Nightly Build" value={runDetails.name} onChange={e => setRunDetails(prev => ({
                ...prev,
                name: e.target.value
              }))} className="bg-background/50" />
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
            <div className="flex gap-3">
              <Button onClick={analyzeFailures} disabled={isAnalyzing} size="lg" className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
                <Zap className="mr-2 h-5 w-5" />
                {isAnalyzing ? 'Analyzing...' : 'Analyze with AI'}
              </Button>
              <Button variant="outline" onClick={handleClearAll} size="lg">
                <Trash2 className="mr-2 h-4 w-4" />
                Clear All
              </Button>
            </div>

            {/* Review Progress Bar */}
            {hasAnalyzedResults && <ReviewProgress reviewed={reviewedCount} total={failuresWithFeedback.length} onComplete={handleCompleteReview} />}

            {/* Search and Filters */}
            {hasAnalyzedResults && <Card className="border-border/50 bg-card/50">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Search Input */}
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search by test name or error message..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 bg-background/50" />
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
                  </div>
                  
                  {/* Results count */}
                  <div className="mt-3 text-xs text-muted-foreground">
                    Showing {filteredFailures.length} of {failuresWithFeedback.length} results
                  </div>
                </CardContent>
              </Card>}

            {/* Results - Row-level card selection based on pre-classification */}
            <div className="space-y-3">
              {hasAnalyzedResults ? filteredFailures.map(f => f.preClassified?.failureType ? <LearningModeCard key={f.id} failure={f} classColors={classColors} priorityColors={priorityColors} /> : <ProductionModeCard key={f.id} failure={f} onFeedback={handleFeedback} classColors={classColors} priorityColors={priorityColors} />) : sortedFailures.map(f => <Card key={f.id} className="animate-fade-in border-border/50 hover:border-border transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-mono text-sm font-medium truncate text-foreground">{f.testName}</h3>
                          {f.errorMessage && <p className="text-xs text-muted-foreground mt-1 truncate">{f.errorMessage}</p>}
                        </div>
                        {f.isAnalyzing && <div className="animate-pulse text-muted-foreground text-sm">Analyzing...</div>}
                      </div>
                    </CardContent>
                  </Card>)}
            </div>
          </>}
      </div>

      {/* Feedback Summary Dialog */}
      <FeedbackSummaryDialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog} summary={summary} onSave={handleSaveReport} onDiscard={handleDiscardReport} isSaving={isSaving} />
    </div>;
};
export default Index;