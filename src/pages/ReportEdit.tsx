import { useEffect, useState, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useReports, ReportResult } from '@/hooks/useReports';
import { useBugCategories } from '@/hooks/useBugCategories';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ArrowLeft, Save, FileText, Search, Filter, CheckCircle2, XCircle, Edit3, Brain } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Classification, Priority, SuggestedAction } from '@/types/testim';

const classifications: Classification[] = [
  'Potential bug',
  'Likely Flaky',
  'Environment / Infra Issue',
  'Expected Change'
];

const priorities: Priority[] = ['P0', 'P1', 'P2', 'P3'];
const actions: SuggestedAction[] = ['Open bug', 'Update shared step', 'Rerun only', 'Ignore today / monitor'];

const classColors: Record<string, string> = {
  'Potential bug': 'bg-bug text-bug-foreground',
  'Likely Flaky': 'bg-flaky text-flaky-foreground',
  'Environment / Infra Issue': 'bg-environment text-environment-foreground',
  'Expected Change': 'bg-expected text-expected-foreground',
};

const priorityColors: Record<string, string> = { P0: 'bg-p0', P1: 'bg-p1', P2: 'bg-p2', P3: 'bg-p3' };

export default function ReportEdit() {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const { categories } = useBugCategories();
  const {
    currentReport,
    currentResults,
    isLoading,
    fetchReportById,
    updateReport,
    updateResult,
  } = useReports();

  const [editingName, setEditingName] = useState(false);
  const [reportName, setReportName] = useState('');
  const [reportNotes, setReportNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClassification, setFilterClassification] = useState<string>('all');
  const [filterCorrectness, setFilterCorrectness] = useState<'all' | 'correct' | 'incorrect'>('all');
  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<ReportResult>>({});

  useEffect(() => {
    if (reportId) {
      fetchReportById(reportId);
    }
  }, [reportId, fetchReportById]);

  useEffect(() => {
    if (currentReport) {
      setReportName(currentReport.run_name);
      setReportNotes(currentReport.notes || '');
    }
  }, [currentReport]);

  const filteredResults = useMemo(() => {
    return currentResults.filter(r => {
      const matchesSearch = !searchQuery ||
        r.test_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.error_message?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesClassification = filterClassification === 'all' ||
        r.ai_classification === filterClassification;
      const matchesCorrectness = filterCorrectness === 'all' ||
        (filterCorrectness === 'correct' && r.was_correct) ||
        (filterCorrectness === 'incorrect' && !r.was_correct);
      return matchesSearch && matchesClassification && matchesCorrectness;
    });
  }, [currentResults, searchQuery, filterClassification, filterCorrectness]);

  const handleSaveReportName = async () => {
    if (!reportId) return;
    const success = await updateReport(reportId, {
      run_name: reportName,
      notes: reportNotes,
    });
    if (success) {
      setEditingName(false);
    }
  };

  const handleStartEditResult = (result: ReportResult) => {
    setEditingResultId(result.id);
    setEditValues({
      user_classification: result.user_classification || result.ai_classification,
      user_priority: result.user_priority || result.ai_priority,
      user_action: result.user_action || result.ai_action,
      user_notes: result.user_notes || '',
      bug_category: result.bug_category,
      bug_link: result.bug_link,
    });
  };

  const handleSaveResult = async (resultId: string) => {
    const wasCorrect = editValues.user_classification === currentResults.find(r => r.id === resultId)?.ai_classification;
    
    const success = await updateResult(resultId, {
      ...editValues,
      was_correct: wasCorrect,
    });
    
    if (success) {
      setEditingResultId(null);
      setEditValues({});
      
      // Recalculate report accuracy
      const updatedResults = currentResults.map(r => 
        r.id === resultId ? { ...r, ...editValues, was_correct: wasCorrect } : r
      );
      const correctCount = updatedResults.filter(r => r.was_correct !== false).length;
      const accuracy = (correctCount / updatedResults.length) * 100;
      
      await updateReport(reportId!, {
        correct_count: correctCount,
        accuracy_percentage: accuracy,
      });
    }
  };

  const stats = useMemo(() => {
    const total = currentResults.length;
    const correct = currentResults.filter(r => r.was_correct !== false).length;
    const incorrect = currentResults.filter(r => r.was_correct === false).length;
    const passedLocally = currentResults.filter(r => r.passed_locally).length;
    return { total, correct, incorrect, passedLocally };
  }, [currentResults]);

  if (isLoading && !currentReport) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!currentReport) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Card className="p-8 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Report Not Found</h2>
          <p className="text-muted-foreground mb-4">The report you're looking for doesn't exist.</p>
          <Button asChild>
            <Link to="/reports">Back to Reports</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/reports">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            {editingName ? (
              <div className="flex items-center gap-3">
                <Input
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  className="text-xl font-bold w-64"
                  autoFocus
                />
                <Button onClick={handleSaveReportName} size="sm">
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditingName(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-foreground">{currentReport.run_name}</h1>
                    <Button variant="ghost" size="icon" onClick={() => setEditingName(true)}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(currentReport.run_date), 'MMMM dd, yyyy')}
                    {currentReport.updated_at && (
                      <> • Updated {format(new Date(currentReport.updated_at), 'MMM dd, HH:mm')}</>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
          <ThemeToggle />
        </header>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border/50">
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-foreground">{stats.total}</div>
              <div className="text-sm text-muted-foreground mt-1">Total Results</div>
            </CardContent>
          </Card>
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="pt-4 text-center">
              <CheckCircle2 className="h-5 w-5 mx-auto text-green-500 mb-1" />
              <div className="text-3xl font-bold text-green-500">{stats.correct}</div>
              <div className="text-sm text-muted-foreground mt-1">AI Correct</div>
            </CardContent>
          </Card>
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="pt-4 text-center">
              <XCircle className="h-5 w-5 mx-auto text-red-500 mb-1" />
              <div className="text-3xl font-bold text-red-500">{stats.incorrect}</div>
              <div className="text-sm text-muted-foreground mt-1">Corrections Made</div>
            </CardContent>
          </Card>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-4 text-center">
              <Brain className="h-5 w-5 mx-auto text-primary mb-1" />
              <div className="text-3xl font-bold text-primary">{stats.passedLocally}</div>
              <div className="text-sm text-muted-foreground mt-1">Passed Locally</div>
            </CardContent>
          </Card>
        </div>

        {/* Notes */}
        {editingName && (
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-sm">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={reportNotes}
                onChange={(e) => setReportNotes(e.target.value)}
                placeholder="Add notes about this report..."
                className="min-h-[80px]"
              />
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by test name or error..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-background/50"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filterClassification} onValueChange={setFilterClassification}>
                  <SelectTrigger className="w-[180px] bg-background/50">
                    <SelectValue placeholder="All Classifications" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classifications</SelectItem>
                    {classifications.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ToggleGroup
                type="single"
                value={filterCorrectness}
                onValueChange={(v) => v && setFilterCorrectness(v as 'all' | 'correct' | 'incorrect')}
                className="bg-background/50 rounded-md p-1"
              >
                <ToggleGroupItem value="all" className="text-xs px-3">All</ToggleGroupItem>
                <ToggleGroupItem value="correct" className="text-xs px-3">Correct</ToggleGroupItem>
                <ToggleGroupItem value="incorrect" className="text-xs px-3">Corrected</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Showing {filteredResults.length} of {currentResults.length} results
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-3">
          {filteredResults.map((result) => (
            <Card key={result.id} className={cn(
              "border-border/50 transition-all",
              result.was_correct === false && "border-red-500/30",
              result.passed_locally && "border-green-500/30"
            )}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-mono text-sm font-medium truncate text-foreground">
                        {result.test_name}
                      </h3>
                      {result.passed_locally && (
                        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 text-xs">
                          ✓ Passed Locally
                        </Badge>
                      )}
                      {result.was_correct === false && (
                        <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30 text-xs">
                          Corrected
                        </Badge>
                      )}
                    </div>
                    {result.error_message && (
                      <p className="text-xs text-muted-foreground truncate mb-3">{result.error_message}</p>
                    )}

                    {/* AI Analysis */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="text-xs text-muted-foreground">AI:</span>
                      <Badge className={cn("text-xs", classColors[result.ai_classification])}>
                        {result.ai_classification}
                      </Badge>
                      <Badge className={cn("text-xs", priorityColors[result.ai_priority])}>
                        {result.ai_priority}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {result.ai_confidence}% confidence
                      </Badge>
                    </div>

                    {/* User Correction (if different) */}
                    {result.was_correct === false && result.user_classification && (
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="text-xs text-muted-foreground">Corrected to:</span>
                        <Badge className={cn("text-xs", classColors[result.user_classification])}>
                          {result.user_classification}
                        </Badge>
                        {result.user_priority && (
                          <Badge className={cn("text-xs", priorityColors[result.user_priority])}>
                            {result.user_priority}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Passed Locally Details */}
                    {result.passed_locally && result.passed_locally_reason && (
                      <div className="text-xs text-muted-foreground mb-2">
                        <span className="font-medium">Reason:</span> {result.passed_locally_reason}
                        {result.passed_locally_notes && <> • {result.passed_locally_notes}</>}
                      </div>
                    )}

                    {/* Bug Link */}
                    {result.bug_link && (
                      <div className="text-xs">
                        <a href={result.bug_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          {result.bug_link}
                        </a>
                      </div>
                    )}

                    {/* Edit Mode */}
                    {editingResultId === result.id && (
                      <div className="mt-4 p-4 bg-muted/30 rounded-lg space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Classification</label>
                            <Select
                              value={editValues.user_classification || ''}
                              onValueChange={(v) => setEditValues(prev => ({ ...prev, user_classification: v }))}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {classifications.map(c => (
                                  <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Priority</label>
                            <Select
                              value={editValues.user_priority || ''}
                              onValueChange={(v) => setEditValues(prev => ({ ...prev, user_priority: v }))}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {priorities.map(p => (
                                  <SelectItem key={p} value={p}>{p}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Category</label>
                            <Select
                              value={editValues.bug_category || ''}
                              onValueChange={(v) => setEditValues(prev => ({ ...prev, bug_category: v }))}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map(c => (
                                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Bug Link</label>
                          <Input
                            value={editValues.bug_link || ''}
                            onChange={(e) => setEditValues(prev => ({ ...prev, bug_link: e.target.value }))}
                            placeholder="https://..."
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Notes</label>
                          <Textarea
                            value={editValues.user_notes || ''}
                            onChange={(e) => setEditValues(prev => ({ ...prev, user_notes: e.target.value }))}
                            placeholder="Add notes..."
                            className="mt-1 min-h-[60px]"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => handleSaveResult(result.id)} size="sm">
                            <Save className="h-4 w-4 mr-1" />
                            Save Changes
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setEditingResultId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {editingResultId !== result.id && (
                    <Button variant="outline" size="sm" onClick={() => handleStartEditResult(result)}>
                      <Edit3 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
