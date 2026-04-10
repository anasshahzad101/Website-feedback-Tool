"use client";

import { useState } from "react";
import { ShareLink, ReviewItem, Project, ReviewRevision } from "@prisma/client";
import { CommentStatus } from "@prisma/client";
import { GuestIdentityGate } from "./guest-identity-gate";
import { ReviewViewer } from "@/components/viewers/review-viewer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, Image, FileText, Video, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useBranding } from "@/contexts/branding-context";
import { BrandMark } from "@/components/brand/brand-mark";

interface GuestReviewPageProps {
  shareLink: ShareLink;
  reviewItem: (ReviewItem & {
    project: Project & { client: { name: string } };
    currentRevision: ReviewRevision | null;
    revisions: ReviewRevision[];
    annotations: Array<{
      id: string;
      annotationType: import("@prisma/client").AnnotationType;
      x: number;
      y: number;
      xPercent: number;
      yPercent: number;
      width: number | null;
      height: number | null;
      widthPercent?: number | null;
      heightPercent?: number | null;
      pointsJson?: string | null;
      targetTimestampMs?: number | null;
      color: string;
      commentThreadId: string | null;
      screenshotContextPath?: string | null;
      pinInCropX?: number | null;
      pinInCropY?: number | null;
      commentThread?: { id: string; status: CommentStatus } | null;
    }>;
    commentThreads: Array<{
      id: string;
      status: string;
      rootAnnotationId: string | null;
      messages: Array<{
        id: string;
        body: string;
        createdAt: Date;
        createdByUser?: { firstName: string; lastName: string } | null;
        createdByGuest?: { name: string } | null;
        isSystemMessage: boolean;
      }>;
    }>;
  }) | null;
  project: (Project & { client: { name: string }; reviewItems: Array<ReviewItem & { currentRevision: ReviewRevision | null }> }) | null;
  allowGuestComments: boolean;
}

const typeIcons = {
  WEBSITE: Globe,
  IMAGE: Image,
  PDF: FileText,
  VIDEO: Video,
};

function GuestHeaderBrand({
  showNameOnMobile = false,
}: {
  showNameOnMobile?: boolean;
}) {
  const { brandName } = useBranding();
  return (
    <div className="flex items-center gap-2">
      <BrandMark className="h-8 w-8 rounded-md" />
      <span
        className={
          showNameOnMobile
            ? "font-semibold"
            : "font-semibold hidden sm:inline"
        }
      >
        {brandName}
      </span>
    </div>
  );
}

export function GuestReviewPage({
  shareLink,
  reviewItem,
  project,
  allowGuestComments,
}: GuestReviewPageProps) {
  const [guestIdentity, setGuestIdentity] = useState<{ id: string; name: string; email?: string } | null>(null);

  // If guest commenting is enabled but no identity yet, show the gate
  if (allowGuestComments && !guestIdentity) {
    return (
      <GuestIdentityGate
        shareToken={shareLink.token}
        onIdentityEstablished={setGuestIdentity}
      />
    );
  }

  // Single review item view
  if (reviewItem) {
    const TypeIcon = typeIcons[reviewItem.type];

    return (
      <div className="h-screen flex flex-col bg-background">
        {/* Header */}
        <header className="border-b bg-card px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <GuestHeaderBrand />
              <span className="text-muted-foreground">|</span>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-primary/10">
                  <TypeIcon className="h-4 w-4 text-primary" />
                </div>
                <span className="font-medium">{reviewItem.title}</span>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {reviewItem.project.name} • {reviewItem.project.client.name}
            </div>
          </div>
        </header>

        {/* Reviewer viewer */}
        <div className="flex-1 overflow-hidden">
          <ReviewViewer
            reviewItem={reviewItem}
            annotations={reviewItem.annotations}
            commentThreads={reviewItem.commentThreads.map(t => ({
              ...t,
              status: t.status as import("@prisma/client").CommentStatus,
              assignedTo: null,
            }))}
            currentRevision={reviewItem.currentRevision}
            revisions={reviewItem.revisions}
            user={guestIdentity ? {
              id: guestIdentity.id,
              firstName: guestIdentity.name,
              lastName: "",
              role: "GUEST",
            } : {
              id: "guest",
              firstName: "Guest",
              lastName: "",
              role: "GUEST",
            }}
            userRole={null}
          />
        </div>
      </div>
    );
  }

  // Project overview view (multiple review items)
  if (project) {
    return (
      <div className="min-h-screen bg-muted/30">
        {/* Header */}
        <header className="border-b bg-card px-6 py-4">
          <div className="flex items-center justify-between">
            <GuestHeaderBrand showNameOnMobile />
          </div>
        </header>

        <main className="max-w-5xl mx-auto p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">{project.name}</h1>
            <p className="text-muted-foreground mt-1">{project.client.name}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {project.reviewItems.map((item) => {
              const TypeIcon = typeIcons[item.type];
              return (
                <Link key={item.id} href={`/review/${shareLink.token}?item=${item.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <TypeIcon className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{item.title}</CardTitle>
                          <CardDescription className="capitalize">
                            {item.type.toLowerCase()}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="outline">
                        {item.currentRevision?.revisionLabel || "View"}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  return null;
}
