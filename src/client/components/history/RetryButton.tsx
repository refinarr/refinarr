"use client";
import { Button } from "@/client/components/ui/button";
import { RotateCcw } from "lucide-react";
import { useRetryAction } from "@/client/hooks/useRetryAction";
import { toast } from "sonner";

export function RetryButton({ logId, title }: { logId: number; title: string }) {
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
    <Button variant="outline" size="sm" onClick={handleRetry} disabled={retry.isPending}>
      <RotateCcw className="h-3 w-3 mr-1" /> Retry
    </Button>
  );
}
