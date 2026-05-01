"use client";
import { Card, CardContent } from "@/client/components/ui/card";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Edit2, Trash2, Plug } from "lucide-react";
import { useDeleteInstance, useTestConnection } from "@/client/hooks/useInstances";
import { withToast } from "@/client/lib/with-toast";
import type { Instance } from "@/shared/types/models";

interface Props {
  instance: Instance;
  failedCount?: number;
  onEdit: () => void;
}

export function InstanceCard({ instance, failedCount = 0, onEdit }: Props) {
  const deleteInstance = useDeleteInstance();
  const test = useTestConnection();

  const runTest = withToast(test, {
    success: `${instance.name}: connected`,
    error: `${instance.name}: connection failed`,
  });
  const runDelete = withToast(deleteInstance, {
    success: "Instance deleted",
    error: "Failed to delete instance",
  });

  const handleTest = () => runTest(instance.id);
  const handleDelete = () => runDelete(instance.id);

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <Badge variant="outline" className="capitalize">{instance.type}</Badge>
        <div className="flex-1">
          <p className="font-medium">{instance.name}</p>
          <p className="text-xs text-muted-foreground">{instance.url}</p>
        </div>
        {failedCount > 0 && (
          <Badge variant="destructive">{failedCount} failed</Badge>
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleTest} disabled={test.isPending}>
            <Plug className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={onEdit}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleDelete} disabled={deleteInstance.isPending}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
