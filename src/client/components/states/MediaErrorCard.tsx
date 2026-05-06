"use client";
import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";

interface Props {
  message?: string;
  onRetry?: () => void;
}

export function MediaErrorCard({ message, onRetry }: Props) {
  const t = useTranslations("states.mediaError");
  return (
    <Card className="border-destructive">
      <CardContent className="flex items-center gap-4 py-6">
        <AlertCircle className="text-destructive size-8 shrink-0" />
        <div className="flex-1">
          <p className="font-medium">{t("title")}</p>
          <p className="text-muted-foreground text-sm">
            {message ?? t("body")}
          </p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            {t("retry")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
