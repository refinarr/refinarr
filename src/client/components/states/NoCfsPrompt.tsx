"use client";
import { ListX } from "lucide-react";

export function NoCfsPrompt() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <ListX className="h-12 w-12 text-muted-foreground" />
      <div>
        <p className="text-lg font-semibold">No Custom Formats configured</p>
        <p className="text-sm text-muted-foreground mt-1">
          Go to Settings and pick the Custom Formats you want for this instance.
        </p>
      </div>
    </div>
  );
}
