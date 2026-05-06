"use client";
import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/client/components/ui/button";
import { useRetryAction } from "@/client/hooks/data/useRetryAction";
import { withToast } from "@/client/lib/with-toast";

interface Props {
  logId: number;
  title: string;
}

export function RetryButton({ logId, title }: Props) {
  const tHistory = useTranslations("history.retry");
  const tRetry = useTranslations("toast.retry");
  const retry = useRetryAction();
  const retryWithToast = withToast(retry, {
    loading: tRetry("running", { title }),
    success: tRetry("succeeded"),
    error: tRetry("failed"),
  });

  const handleRetry = async () => {
    await retryWithToast(logId);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRetry}
      disabled={retry.isPending}
    >
      <RotateCcw className="mr-1 size-3" /> {tHistory("retry")}
    </Button>
  );
}
