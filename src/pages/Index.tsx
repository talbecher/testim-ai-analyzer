import { useState, useRef } from 'react';
import { useChecklist } from '@/hooks/useChecklist';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Upload, Zap, Trash2, Database, AlertTriangle, Bug, Clock, CheckCircle, CalendarIcon, FileText, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const Index = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { failures, sortedFailures, stats, isLoading, isAnalyzing, error, uploadFailures, analyzeFailures, clearFailures } = useChecklist();
  const [dragOver, setDragOver] = useState(false);
  const [runDetails, setRunDetails] = useState({
    name: '',
    date: new Date(),
    notes: ''
  });

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => uploadFailures(e.target?.result as string);
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.csv')) handleFileUpload(file);
  };

  const classColors = {
    'Real Bug': 'bg-bug text-bug-foreground',
    'Likely Flaky': 'bg-flaky text-flaky-foreground',
    'Environment / Infra Issue': 'bg-environment text-environment-foreground',
    'Expected Change': 'bg-expected text-expected-foreground',
  };

  const priorityColors = { P0: 'bg-p0', P1: 'bg-p1', P2: 'bg-p2', P3: 'bg-p3' };

  return (
    <div className="min-h-screen bg-background dark p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <header className="text-center space-y-3 py-4">
          <div className="flex items-center justify-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bug className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">
              Testim.io Regression Failure Analyzer
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">AI-powered test failure classification & prioritization</p>
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
                <Input
                  placeholder="e.g., Regression 1, Nightly Build"
                  value={runDetails.name}
                  onChange={(e) => setRunDetails(prev => ({ ...prev, name: e.target.value }))}
                  className="bg-background/50"
                />
              </div>

              {/* Date Picker */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-background/50",
                        !runDetails.date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {runDetails.date ? format(runDetails.date, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={runDetails.date}
                      onSelect={(date) => date && setRunDetails(prev => ({ ...prev, date }))}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Notes (optional)</label>
              <Textarea
                placeholder="Add any relevant notes about this run... e.g., Weekly regression after release 2.5.0"
                value={runDetails.notes}
                onChange={(e) => setRunDetails(prev => ({ ...prev, notes: e.target.value }))}
                className="bg-background/50 min-h-[80px] resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Upload Area */}
        <Card className={cn(
          "border-2 border-dashed transition-all duration-200",
          dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/50"
        )}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="p-4 rounded-full bg-muted/50">
              <Upload className="h-10 w-10 text-muted-foreground" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-foreground font-medium">Drop your failures CSV here</p>
              <p className="text-sm text-muted-foreground">or click to browse</p>
            </div>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="mt-2">
              <FileText className="mr-2 h-4 w-4" />
              Select CSV File
            </Button>
          </CardContent>
        </Card>

        {error && <div className="bg-destructive/10 text-destructive p-4 rounded-lg border border-destructive/20">{error}</div>}

        {failures.length > 0 && (
          <>
            {/* Run Info Banner */}
            {runDetails.name && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">Run:</span>
                  <span className="font-semibold text-foreground">{runDetails.name}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-sm text-muted-foreground">{format(runDetails.date, "PPP")}</span>
                </div>
                {runDetails.notes && (
                  <span className="text-sm text-muted-foreground italic truncate max-w-[300px]">{runDetails.notes}</span>
                )}
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-border/50">
                <CardContent className="pt-4 text-center">
                  <div className="text-3xl font-bold text-foreground">{stats.total}</div>
                  <div className="text-sm text-muted-foreground mt-1">Total Failures</div>
                </CardContent>
              </Card>
              <Card className="border-bug/30 bg-bug/5">
                <CardContent className="pt-4 text-center">
                  <Bug className="h-5 w-5 mx-auto text-bug mb-1" />
                  <div className="text-3xl font-bold text-bug">{stats.realBugs}</div>
                  <div className="text-sm text-muted-foreground mt-1">Real Bugs</div>
                </CardContent>
              </Card>
              <Card className="border-flaky/30 bg-flaky/5">
                <CardContent className="pt-4 text-center">
                  <AlertTriangle className="h-5 w-5 mx-auto text-flaky mb-1" />
                  <div className="text-3xl font-bold text-flaky">{stats.flaky}</div>
                  <div className="text-sm text-muted-foreground mt-1">Flaky Tests</div>
                </CardContent>
              </Card>
              <Card className="border-environment/30 bg-environment/5">
                <CardContent className="pt-4 text-center">
                  <Clock className="h-5 w-5 mx-auto text-environment mb-1" />
                  <div className="text-3xl font-bold text-environment">{stats.environment}</div>
                  <div className="text-sm text-muted-foreground mt-1">Environment Issues</div>
                </CardContent>
              </Card>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button onClick={analyzeFailures} disabled={isAnalyzing} size="lg" className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
                <Zap className="mr-2 h-5 w-5" />
                {isAnalyzing ? 'Analyzing...' : 'Analyze with AI'}
              </Button>
              <Button variant="outline" onClick={clearFailures} size="lg">
                <Trash2 className="mr-2 h-4 w-4" />
                Clear All
              </Button>
            </div>

            {/* Results */}
            <div className="space-y-3">
              {sortedFailures.map((f) => (
                <Card key={f.id} className="animate-fade-in border-border/50 hover:border-border transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-mono text-sm font-medium truncate text-foreground">{f.testName}</h3>
                        {f.errorMessage && <p className="text-xs text-muted-foreground mt-1 truncate">{f.errorMessage}</p>}
                      </div>
                      {f.analysis && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={cn("px-2 py-1 rounded text-xs font-medium", priorityColors[f.analysis.priority], "text-white")}>{f.analysis.priority}</span>
                          <span className={cn("px-2 py-1 rounded text-xs font-medium", classColors[f.analysis.classification])}>{f.analysis.classification}</span>
                          <span className="text-xs text-muted-foreground">{f.analysis.confidence}%</span>
                          {f.analysis.flakyKBMatch && <Database className="h-4 w-4 text-primary" />}
                          {f.analysis.requiresRerun ? <Clock className="h-4 w-4 text-environment" /> : <CheckCircle className="h-4 w-4 text-confidence-high" />}
                        </div>
                      )}
                      {f.isAnalyzing && <div className="animate-pulse text-muted-foreground text-sm">Analyzing...</div>}
                    </div>
                    {f.analysis?.priorityReason && (
                      <p className="text-xs text-muted-foreground mt-2 whitespace-pre-line">{f.analysis.priorityReason}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Index;
