"use client";
import { CheckCircle2 } from "lucide-react";

export function AllClearState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <CheckCircle2 className="h-12 w-12 text-green-500" />
      <div>
        <p className="text-lg font-semibold">All clear!</p>
        <p className="text-sm text-muted-foreground mt-1">
          Every item meets your Custom Format targets.
        </p>
      </div>
    </div>
  );
}
