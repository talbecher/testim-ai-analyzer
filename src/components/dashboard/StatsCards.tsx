import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Target, AlertTriangle, FileText } from "lucide-react";

interface StatsCardsProps {
  totalReports: number;
  totalAnalyzed: number;
  overallAccuracy: number;
  totalMistakes: number;
}

export const StatsCards = ({
  totalReports,
  totalAnalyzed,
  overallAccuracy,
  totalMistakes,
}: StatsCardsProps) => {
  const stats = [
    {
      label: "Total Reports",
      value: totalReports,
      icon: FileText,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "Tests Analyzed",
      value: totalAnalyzed,
      icon: Target,
      color: "text-expected",
      bgColor: "bg-expected/10",
    },
    {
      label: "Overall Accuracy",
      value: `${overallAccuracy.toFixed(1)}%`,
      icon: TrendingUp,
      color: overallAccuracy >= 80 ? "text-confidence-high" : overallAccuracy >= 60 ? "text-flaky" : "text-bug",
      bgColor: overallAccuracy >= 80 ? "bg-confidence-high/10" : overallAccuracy >= 60 ? "bg-flaky/10" : "bg-bug/10",
    },
    {
      label: "Total Corrections",
      value: totalMistakes,
      icon: AlertTriangle,
      color: "text-environment",
      bgColor: "bg-environment/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
