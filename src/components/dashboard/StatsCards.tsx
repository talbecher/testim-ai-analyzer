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
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Tests Analyzed",
      value: totalAnalyzed,
      icon: Target,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      label: "Overall Accuracy",
      value: `${overallAccuracy.toFixed(1)}%`,
      icon: TrendingUp,
      color: overallAccuracy >= 80 ? "text-green-500" : overallAccuracy >= 60 ? "text-yellow-500" : "text-red-500",
      bgColor: overallAccuracy >= 80 ? "bg-green-500/10" : overallAccuracy >= 60 ? "bg-yellow-500/10" : "bg-red-500/10",
    },
    {
      label: "Total Corrections",
      value: totalMistakes,
      icon: AlertTriangle,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
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
