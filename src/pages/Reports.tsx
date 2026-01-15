import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useReports, ReportData } from '@/hooks/useReports';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, FileText, Pencil, Trash2, Brain, Search, BarChart3, Bug, Settings as SettingsIcon, Rocket } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { format } from 'date-fns';

export default function Reports() {
  const navigate = useNavigate();
  const { reports, isLoading, fetchReports, deleteReport, getLearningStats } = useReports();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [learningStats, setLearningStats] = useState({ totalCorrections: 0, totalPassedLocally: 0 });

  useEffect(() => {
    fetchReports();
    getLearningStats().then(setLearningStats);
  }, [fetchReports, getLearningStats]);

  const filteredReports = reports.filter(r =>
    r.run_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.notes?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async () => {
    if (deleteId) {
      await deleteReport(deleteId);
      setDeleteId(null);
    }
  };

  const getAccuracyBadge = (accuracy: number | null) => {
    if (accuracy === null) return <Badge variant="secondary">N/A</Badge>;
    if (accuracy >= 80) return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">{accuracy.toFixed(0)}%</Badge>;
    if (accuracy >= 60) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">{accuracy.toFixed(0)}%</Badge>;
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{accuracy.toFixed(0)}%</Badge>;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Saved Reports</h1>
                <p className="text-sm text-muted-foreground">View and manage your analysis reports</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <ThemeToggle />
            <Button asChild variant="outline" size="sm">
              <Link to="/ai-learning">
                <Brain className="mr-2 h-4 w-4" />
                AI Learning
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
        </header>

        {/* Learning Stats Banner */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Brain className="h-8 w-8 text-primary" />
                <div>
                  <h3 className="font-semibold text-foreground">AI Learning Status</h3>
                  <p className="text-sm text-muted-foreground">
                    AI is learning from <span className="font-bold text-primary">{learningStats.totalCorrections}</span> corrections 
                    and <span className="font-bold text-primary">{learningStats.totalPassedLocally}</span> "passed locally" patterns
                  </p>
                </div>
              </div>
              <Button variant="outline" asChild>
                <Link to="/ai-learning">View Details</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reports by name or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background/50"
          />
        </div>

        {/* Reports Table */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              All Reports ({filteredReports.length})
            </CardTitle>
            <CardDescription>
              Click on a report to view and edit its results
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No reports found</p>
                <p className="text-sm mt-1">
                  {searchQuery ? 'Try a different search term' : 'Start by analyzing some test failures'}
                </p>
                {!searchQuery && (
                  <Button asChild className="mt-4">
                    <Link to="/">
                      <Bug className="mr-2 h-4 w-4" />
                      Analyze Failures
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Run Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-center">Analyzed</TableHead>
                    <TableHead className="text-center">Correct</TableHead>
                    <TableHead className="text-center">Accuracy</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.map((report) => (
                    <TableRow 
                      key={report.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/reports/${report.id}`)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{report.run_name}</span>
                          {report.is_feature_rollout && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs">
                              <Rocket className="h-3 w-3 mr-1" />
                              Feature Rollout
                            </Badge>
                          )}
                        </div>
                        {report.notes && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {report.notes}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(report.run_date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {report.updated_at 
                          ? format(new Date(report.updated_at), 'MMM dd, HH:mm')
                          : format(new Date(report.created_at), 'MMM dd, HH:mm')
                        }
                      </TableCell>
                      <TableCell className="text-center">{report.total_analyzed}</TableCell>
                      <TableCell className="text-center">{report.correct_count}</TableCell>
                      <TableCell className="text-center">{getAccuracyBadge(report.accuracy_percentage)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/reports/${report.id}`)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(report.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Report?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the report and all its results.
                The AI will no longer learn from the corrections in this report.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
