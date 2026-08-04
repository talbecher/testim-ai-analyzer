import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, Target, AlertTriangle, BarChart3 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AppLogo } from "@/components/AppLogo";
import { AccuracyTrendChart } from "@/components/dashboard/AccuracyTrendChart";
import { MistakePatternChart } from "@/components/dashboard/MistakePatternChart";
import { RecentReportsTable } from "@/components/dashboard/RecentReportsTable";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { Skeleton } from "@/components/ui/skeleton";

interface ReportData {
  id: string;
  run_name: string;
  run_date: string;
  total_analyzed: number;
  correct_count: number;
  accuracy_percentage: number | null;
  common_mistakes: Array<{ from: string; to: string; count: number }>;
  created_at: string;
}

interface AggregatedMistake {
  pattern: string;
  count: number;
}

const Dashboard = () => {
  const [reports, setReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    const { data, error } = await supabase
      .from("analysis_reports")
      .select("*")
      .order("run_date", { ascending: true });

    if (!error && data) {
      const typedData = data.map((report) => ({
        ...report,
        common_mistakes: Array.isArray(report.common_mistakes) 
          ? (report.common_mistakes as Array<{ from: string; to: string; count: number }>)
          : []
      }));
      setReports(typedData);
    }
    setLoading(false);
  };

  // Calculate aggregated stats
  const totalReports = reports.length;
  const totalAnalyzed = reports.reduce((sum, r) => sum + r.total_analyzed, 0);
  const totalCorrect = reports.reduce((sum, r) => sum + r.correct_count, 0);
  const overallAccuracy = totalAnalyzed > 0 ? (totalCorrect / totalAnalyzed) * 100 : 0;

  // Aggregate all mistake patterns
  const aggregatedMistakes: AggregatedMistake[] = [];
  reports.forEach((report) => {
    report.common_mistakes.forEach((mistake) => {
      // Skip non-mistakes (same classification on both sides – e.g. confirmed AI)
      if (!mistake.from || !mistake.to || mistake.from === mistake.to) return;
      const pattern = `${mistake.from} → ${mistake.to}`;
      const existing = aggregatedMistakes.find((m) => m.pattern === pattern);
      if (existing) {
        existing.count += mistake.count;
      } else {
        aggregatedMistakes.push({ pattern, count: mistake.count });
      }
    });
  });
  aggregatedMistakes.sort((a, b) => b.count - a.count);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-7xl space-y-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-80 max-w-full" />
              </div>
            </div>
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-[320px] w-full" />
            <Skeleton className="h-[320px] w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <AppLogo size="lg" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">AI Analysis Dashboard</h1>
              <p className="text-muted-foreground mt-1">Track accuracy trends and common failure patterns</p>
            </div>
          </div>
          <div className="flex gap-2">
            <ThemeToggle />
            <Button asChild variant="outline">
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Analyzer
              </Link>
            </Button>
          </div>
        </div>

        {reports.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <AppLogo size="lg" className="mb-4 opacity-90" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Reports Yet</h3>
              <p className="text-muted-foreground text-center max-w-md mb-4">
                Start analyzing test failures and saving reports to see accuracy trends and patterns here.
              </p>
              <Button asChild>
                <Link to="/">Analyze Failures</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Stats Cards */}
            <StatsCards
              totalReports={totalReports}
              totalAnalyzed={totalAnalyzed}
              overallAccuracy={overallAccuracy}
              totalMistakes={aggregatedMistakes.reduce((sum, m) => sum + m.count, 0)}
            />

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AccuracyTrendChart reports={reports} />
              <MistakePatternChart mistakes={aggregatedMistakes.slice(0, 5)} />
            </div>

            {/* Recent Reports Table */}
            <RecentReportsTable reports={[...reports].reverse().slice(0, 10)} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
