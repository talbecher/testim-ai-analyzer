import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";

interface MistakePatternChartProps {
  mistakes: Array<{ pattern: string; count: number }>;
}

const COLORS = [
  "hsl(var(--destructive))",
  "hsl(346 77% 60%)",
  "hsl(25 95% 53%)",
  "hsl(45 93% 47%)",
  "hsl(142 76% 36%)",
];

export const MistakePatternChart = ({ mistakes }: MistakePatternChartProps) => {
  const chartConfig = {
    count: {
      label: "Occurrences",
      color: "hsl(var(--destructive))",
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          ⚠️ Common Mistakes
        </CardTitle>
        <CardDescription>Most frequent AI misclassifications</CardDescription>
      </CardHeader>
      <CardContent>
        {mistakes.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            No mistakes recorded yet - great job!
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <BarChart
              data={mistakes}
              layout="vertical"
              margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
            >
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="pattern"
                tickLine={false}
                axisLine={false}
                width={150}
                tick={{ fontSize: 11 }}
              />
              <ChartTooltip
                content={<ChartTooltipContent />}
                formatter={(value: number) => [`${value} times`, "Occurred"]}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {mistakes.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};
