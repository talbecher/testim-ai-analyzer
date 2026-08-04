import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { format } from "date-fns";

interface ReportData {
  id: string;
  run_name: string;
  run_date: string;
  total_analyzed: number;
  correct_count: number;
  accuracy_percentage: number | null;
  created_at: string;
}

interface RecentReportsTableProps {
  reports: ReportData[];
}

export const RecentReportsTable = ({ reports }: RecentReportsTableProps) => {
  const getAccuracyBadge = (accuracy: number | null) => {
    if (accuracy === null) return <Badge variant="secondary">N/A</Badge>;
    if (accuracy >= 90) return <Badge className="bg-green-500/20 text-green-600 hover:bg-green-500/30">{accuracy.toFixed(1)}%</Badge>;
    if (accuracy >= 75) return <Badge className="bg-yellow-500/20 text-yellow-600 hover:bg-yellow-500/30">{accuracy.toFixed(1)}%</Badge>;
    return <Badge className="bg-red-500/20 text-red-600 hover:bg-red-500/30">{accuracy.toFixed(1)}%</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" aria-hidden />
          Recent Reports
        </CardTitle>
        <CardDescription>Latest analysis runs and their results</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Run Name</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-center">Analyzed</TableHead>
              <TableHead className="text-center">Correct</TableHead>
              <TableHead className="text-center">Accuracy</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.map((report) => (
              <TableRow key={report.id}>
                <TableCell className="font-medium">{report.run_name}</TableCell>
                <TableCell>{format(new Date(report.run_date), "MMM d, yyyy")}</TableCell>
                <TableCell className="text-center">{report.total_analyzed}</TableCell>
                <TableCell className="text-center">{report.correct_count}</TableCell>
                <TableCell className="text-center">
                  {getAccuracyBadge(report.accuracy_percentage)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
