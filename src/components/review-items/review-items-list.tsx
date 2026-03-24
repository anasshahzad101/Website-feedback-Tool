"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, GitBranch, Globe, Image, FileText, Video } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { ReviewItemType } from "@prisma/client";

interface ReviewItem {
  id: string;
  title: string;
  type: ReviewItemType;
  sourceUrl: string | null;
  uploadedFilePath: string | null;
  thumbnailPath: string | null;
  guestCommentingEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  project: {
    id: string;
    name: string;
    slug: string;
    client: {
      id: string;
      name: string;
      companyName: string | null;
    };
  };
  currentRevision: {
    id: string;
    revisionLabel: string | null;
    revisionDate: Date;
  } | null;
  _count: {
    commentThreads: number;
    annotations: number;
  };
}

interface ReviewItemsListProps {
  reviewItems: ReviewItem[];
}

const typeIcons: Record<ReviewItemType, typeof Globe> = {
  WEBSITE: Globe,
  IMAGE: Image,
  PDF: FileText,
  VIDEO: Video,
};

const typeLabels: Record<ReviewItemType, string> = {
  WEBSITE: "Website",
  IMAGE: "Image",
  PDF: "PDF",
  VIDEO: "Video",
};

const typeColors: Record<ReviewItemType, string> = {
  WEBSITE: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  IMAGE: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  PDF: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  VIDEO: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
};

export function ReviewItemsList({ reviewItems }: ReviewItemsListProps) {
  if (reviewItems.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No review items yet.</p>
        <p className="text-sm mt-1">Add your first review item to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {reviewItems.map((item) => {
        const TypeIcon = typeIcons[item.type];
        return (
          <Link key={item.id} href={`/review-items/${item.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${typeColors[item.type]}`}>
                      <TypeIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{item.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {item.project.name} • {item.project.client.companyName || item.project.client.name}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-4 w-4" />
                      {item._count.commentThreads}
                    </span>
                  <span className="flex items-center gap-1">
                    <GitBranch className="h-4 w-4" />
                    {item._count.annotations} annotations
                  </span>
                  </div>
                  <span>{formatDate(item.updatedAt)}</span>
                </div>
                {item.currentRevision?.revisionLabel && (
                  <div className="mt-3">
                    <Badge variant="outline">{item.currentRevision.revisionLabel}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
