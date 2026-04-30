"use client";
import { AlertCircle } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";

interface Props {
  message?: string;
  onRetry?: () => void;
}

export function MediaErrorCard({ message = "Failed to load data", onRetry }: Props) {
  return (
    <Card className="border-destructive">
      <CardContent className="flex items-center gap-4 py-6">
        <AlertCircle className="h-8 w-8 text-destructive shrink-0" />
        <div className="flex-1">
          <p className="font-medium">Error</p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
