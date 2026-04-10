"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectsList } from "@/components/projects/projects-list";
import type { SerializedProjectForList } from "@/lib/projects/serialize-project-list";

/**
 * Radix Tabs + nested content live in a client boundary so the server page only
 * passes plain JSON props (avoids fragile RSC slot serialization with Tabs).
 */
export function ProjectsPageTabs({
  activeSerialized,
  archivedSerialized,
}: {
  activeSerialized: SerializedProjectForList[];
  archivedSerialized: SerializedProjectForList[];
}) {
  const archivedCount = archivedSerialized.length;

  return (
    <Tabs defaultValue="active" className="space-y-4">
      <TabsList className="bg-slate-100 p-1 rounded-lg">
        <TabsTrigger
          value="active"
          className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
        >
          Active ({activeSerialized.length})
        </TabsTrigger>
        {archivedCount > 0 && (
          <TabsTrigger
            value="archived"
            className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            Archived ({archivedCount})
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="active" className="mt-4">
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-white/80">
            <CardTitle className="text-base font-medium text-slate-900">
              Active Projects
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <ProjectsList projects={activeSerialized} />
          </CardContent>
        </Card>
      </TabsContent>

      {archivedCount > 0 && (
        <TabsContent value="archived" className="mt-4">
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-white/80">
              <CardTitle className="text-base font-medium text-slate-900">
                Archived Projects
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ProjectsList projects={archivedSerialized} isArchived />
            </CardContent>
          </Card>
        </TabsContent>
      )}
    </Tabs>
  );
}
