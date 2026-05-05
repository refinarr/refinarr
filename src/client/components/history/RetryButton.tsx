"use client";
import { Button } from "@/client/components/ui/button";
import { RotateCcw } from "lucide-react";
import { useRetryAction } from "@/client/hooks/data/useRetryAction";
import { toast } from "sonner";

interface Props {
  logId: number;
  title: string;
}

export function RetryButton({ logId, title }: Props) {
  const retry = useRetryAction();

  const handleRetry = async () => {
    const promise = retry.mutateAsync(logId);
    toast.promise(promise, {
      loading: `Retrying ${title}…`,
      success: "Done",
      error: "Failed again",
    });
    await promise;
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRetry}
      disabled={retry.isPending}
    >
      <RotateCcw className="h-3 w-3 mr-1" /> Retry
    </Button>
  );
}
