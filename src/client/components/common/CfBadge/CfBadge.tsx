"use client";
import { Badge } from "@/client/components/ui/badge";

interface Props {
  name: string;
  missing?: boolean;
}

export function CfBadge({ name, missing = false }: Props) {
  return (
    <Badge variant={missing ? "destructive" : "secondary"} className="text-xs">
      {name}
    </Badge>
  );
}
