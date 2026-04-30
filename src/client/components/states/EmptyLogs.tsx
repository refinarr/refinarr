"use client";
import { ClipboardList } from "lucide-react";

export function EmptyLogs() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <ClipboardList className="h-12 w-12 text-muted-foreground" />
      <div>
        <p className="text-lg font-semibold">No history yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Actions you take will appear here.
        </p>
      </div>
    </div>
  );
}
