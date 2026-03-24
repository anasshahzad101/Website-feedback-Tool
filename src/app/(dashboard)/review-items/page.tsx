import { auth } from "@/lib/auth";
import { db, UserRole, Prisma } from "@/lib/db/client";
import { Permissions } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ReviewItemsList } from "@/components/review-items/review-items-list";
import { Plus } from "lucide-react";

export default async function ReviewItemsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const whereClause: Prisma.ReviewItemWhereInput = !Permissions.canAccessAdminPanel(
    session.user.role as UserRole
  )
    ? { project: { members: { some: { userId: session.user.id } } } }
    : {};

  const reviewItems = await db.reviewItem.findMany({
    where: whereClause,
    orderBy: { updatedAt: "desc" },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          slug: true,
          client: {
            select: {
              id: true,
              name: true,
              companyName: true,
            },
          },
        },
      },
      currentRevision: true,
      _count: {
        select: { commentThreads: true, annotations: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Review Items</h1>
          <p className="text-muted-foreground">
            Websites, images, PDFs, and videos ready for review
          </p>
        </div>
        <Button asChild>
          <Link href="/review-items/new">
            <Plus className="mr-2 h-4 w-4" />
            New Review Item
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Review Items</CardTitle>
        </CardHeader>
        <CardContent>
          <ReviewItemsList reviewItems={reviewItems} />
        </CardContent>
      </Card>
    </div>
  );
}
