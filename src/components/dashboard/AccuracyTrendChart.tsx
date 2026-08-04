import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface ReportData {
  id: string;
  run_name: string;
  run_date: string;
  accuracy_percentage: number | null;
}

interface AccuracyTrendChartProps {
  reports: ReportData[];
}

export const AccuracyTrendChart = ({ reports }: AccuracyTrendChartProps) => {
  const chartData = reports.map((report) => ({
    date: format(new Date(report.run_date), "MMM d"),
    accuracy: report.accuracy_percentage ?? 0,
    name: report.run_name,
  }));

  const chartConfig = {
    accuracy: {
      label: "Accuracy %",
      color: "hsl(var(--primary))",
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" aria-hidden />
          Accuracy Trend
        </CardTitle>
        <CardDescription>AI classification accuracy over time</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length < 2 ? (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            Need at least 2 reports to show trend
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="text-xs"
              />
              <YAxis
                domain={[0, 100]}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => `${value}%`}
                className="text-xs"
              />
              <ChartTooltip
                content={<ChartTooltipContent />}
                formatter={(value: number) => [`${value.toFixed(1)}%`, "Accuracy"]}
              />
              <Line
                type="monotone"
                dataKey="accuracy"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};
