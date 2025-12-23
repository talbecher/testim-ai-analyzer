import { useState, useRef } from 'react';
import { useChecklist } from '@/hooks/useChecklist';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Zap, Trash2, Database, AlertTriangle, Bug, Clock, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const Index = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { failures, sortedFailures, stats, isLoading, isAnalyzing, error, uploadFailures, analyzeFailures, clearFailures } = useChecklist();
  const [dragOver, setDragOver] = useState(false);

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
        <header className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Testim Morning Checklist</h1>
          <p className="text-muted-foreground">AI-powered test failure analysis</p>
        </header>

        {/* Upload Area */}
        <Card className={cn("border-2 border-dashed transition-colors", dragOver ? "border-primary bg-primary/5" : "border-border")}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <Upload className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Drop failures CSV here or</p>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
            <Button onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Upload CSV</Button>
          </CardContent>
        </Card>

        {error && <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>}

        {failures.length > 0 && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold">{stats.total}</div><div className="text-sm text-muted-foreground">Total</div></CardContent></Card>
              <Card className="border-bug/30"><CardContent className="pt-4 text-center"><Bug className="h-5 w-5 mx-auto text-bug" /><div className="text-2xl font-bold text-bug">{stats.realBugs}</div><div className="text-sm text-muted-foreground">Real Bugs</div></CardContent></Card>
              <Card className="border-flaky/30"><CardContent className="pt-4 text-center"><AlertTriangle className="h-5 w-5 mx-auto text-flaky" /><div className="text-2xl font-bold text-flaky">{stats.flaky}</div><div className="text-sm text-muted-foreground">Flaky</div></CardContent></Card>
              <Card className="border-environment/30"><CardContent className="pt-4 text-center"><Clock className="h-5 w-5 mx-auto text-environment" /><div className="text-2xl font-bold text-environment">{stats.environment}</div><div className="text-sm text-muted-foreground">Environment</div></CardContent></Card>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button onClick={analyzeFailures} disabled={isAnalyzing} className="bg-primary"><Zap className="mr-2 h-4 w-4" />{isAnalyzing ? 'Analyzing...' : 'Analyze with AI'}</Button>
              <Button variant="outline" onClick={clearFailures}><Trash2 className="mr-2 h-4 w-4" />Clear</Button>
            </div>

            {/* Results */}
            <div className="space-y-3">
              {sortedFailures.map((f) => (
                <Card key={f.id} className="animate-fade-in">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-mono text-sm font-medium truncate">{f.testName}</h3>
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
