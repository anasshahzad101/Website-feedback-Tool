"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, FolderKanban, Mail, Phone } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Client {
  id: string;
  name: string;
  companyName: string | null;
  email: string;
  phone: string | null;
  createdAt: Date;
  _count: {
    projects: number;
  };
}

interface ClientsTableProps {
  clients: Client[];
}

export function ClientsTable({ clients }: ClientsTableProps) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  if (clients.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No clients yet. Add your first client to get started.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Company</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Projects</TableHead>
          <TableHead>Added</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((client) => (
          <TableRow key={client.id}>
            <TableCell className="font-medium">
              <Link
                href={`/clients/${client.id}`}
                className="hover:underline"
              >
                {client.name}
              </Link>
            </TableCell>
            <TableCell>{client.companyName || "—"}</TableCell>
            <TableCell>
              <div className="flex flex-col gap-1 text-sm">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  {client.email}
                </span>
                {client.phone && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {client.phone}
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <span className="inline-flex items-center gap-1">
                <FolderKanban className="h-3 w-3" />
                {client._count.projects}
              </span>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDate(client.createdAt)}
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/clients/${client.id}`}>View Details</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/clients/${client.id}/edit`}>Edit</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/projects/new?clientId=${client.id}`}>
                      New Project
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
