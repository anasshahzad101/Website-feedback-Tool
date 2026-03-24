import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FolderKanban, FileText, MessageCircle } from "lucide-react";

interface QuickStatsProps {
  stats: {
    clients: number;
    projects: number;
    reviewItems: number;
    openComments: number;
  };
  isAdmin: boolean;
}

export function QuickStats({ stats, isAdmin }: QuickStatsProps) {
  const items = [
    ...(isAdmin
      ? [
          {
            title: "Clients",
            value: stats.clients,
            icon: Users,
            description: "Total clients",
          },
        ]
      : []),
    {
      title: "Active Projects",
      value: stats.projects,
      icon: FolderKanban,
      description: "Projects you can access",
    },
    {
      title: "Review Items",
      value: stats.reviewItems,
      icon: FileText,
      description: "Files & websites to review",
    },
    {
      title: "Open Comments",
      value: stats.openComments,
      icon: MessageCircle,
      description: "Awaiting resolution",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{item.value}</div>
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
