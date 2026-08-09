"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchAudit } from "@/lib/api";
import { CATEGORIES } from "@/lib/types";

const PAGE_SIZE = 20;

const ACTION_COLOR: Record<string, string> = {
  create: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  update: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  delete: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  piipass: "bg-primary/15 text-primary border-primary/30",
  parse: "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

export function AdminAuditLog() {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("");
  const [action, setAction] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["audit", page, PAGE_SIZE],
    queryFn: () => fetchAudit(PAGE_SIZE, page * PAGE_SIZE),
  });

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;

  const filtered = entries.filter((e) => {
    if (action !== "all" && e.action !== action) return false;
    if (filter) {
      const q = filter.toLowerCase();
      return (
        e.summary.toLowerCase().includes(q) ||
        e.actor.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by summary or actor…"
          className="max-w-xs bg-background/60"
        />
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-40 bg-background/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
            <SelectItem value="piipass">PII pass</SelectItem>
            <SelectItem value="parse">Parse</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} shown · {total} total
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/80 bg-card/30">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-24">Action</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead className="w-28">Actor</TableHead>
              <TableHead className="w-44">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4} className="h-12">
                    <div className="h-4 w-full animate-pulse rounded bg-muted/60" />
                  </TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No audit entries match.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((e) => (
                <TableRow
                  key={e.id}
                  className="border-border/60 text-sm hover:bg-muted/30"
                >
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        ACTION_COLOR[e.action] ??
                        "bg-muted/40 text-muted-foreground border-border"
                      }
                    >
                      {e.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-foreground/90">
                    {e.summary}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.actor}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(e.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          Previous
        </Button>
        <span className="text-xs text-muted-foreground">
          Page {page + 1} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={(page + 1) * PAGE_SIZE >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
