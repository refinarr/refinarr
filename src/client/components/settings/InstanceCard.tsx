"use client";
import { useTranslations } from "next-intl";
import {
  ChevronDown,
  ChevronRight,
  Edit2,
  MoreVertical,
  Trash2,
  Plug,
  Hourglass,
} from "lucide-react";
import { Card, CardContent } from "@/client/components/ui/card";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";
import { InstanceConnectionDot } from "@/client/components/common/InstanceConnectionDot";
import { ARR_UI } from "@/client/lib/arr-ui";
import { ShowAllMediaToggle } from "@/client/components/settings/ShowAllMediaToggle";
import { AutoSearchSection } from "@/client/components/settings/InstanceCard/AutoSearchSection";
import {
  useDeleteInstance,
  useTestConnection,
} from "@/client/hooks/data/useInstances";
import { useSearchQueue } from "@/client/hooks/data/useSearchQueue";
import { useConfirm } from "@/client/hooks/ui/useConfirm";
import { useInstanceCardCollapsed } from "@/client/hooks/ui/useInstanceCardCollapsed";
import { withToast } from "@/client/lib/with-toast";
import { formatEta } from "@/client/lib/format-relative";
import type { PublicInstance } from "@/shared/types/api";

interface Props {
  instance: PublicInstance;
  failedCount?: number;
  onEdit: () => void;
}

export function InstanceCard({ instance, failedCount = 0, onEdit }: Props) {
  const tForm = useTranslations("settings.instanceForm");
  const tToast = useTranslations("toast.instance");
  const tCommon = useTranslations("common");
  const tTime = useTranslations("time");
  const deleteInstance = useDeleteInstance();
  const test = useTestConnection();
  const { data: queue } = useSearchQueue(instance.id);
  const { collapsed, toggle: toggleCollapsed } = useInstanceCardCollapsed(
    instance.id,
  );
  const { confirm: askConfirm, dialog: confirmDialog } = useConfirm();
  const tConfirmDelete = useTranslations("confirm.deleteInstance");
  const pendingCount = queue?.pendingCount ?? 0;

  const runTest = withToast(test, {
    success: tToast("testOk", { name: instance.name }),
    error: tToast("testFailed", { name: instance.name }),
  });
  const runDelete = withToast(deleteInstance, {
    success: tToast("deleted"),
    error: tToast("deleteFailed"),
  });

  const handleTest = () => runTest(instance.id);
  const handleDelete = async () => {
    const ok = await askConfirm({
      title: tConfirmDelete("title"),
      body: tConfirmDelete("body", { name: instance.name }),
      destructive: true,
    });
    if (ok) runDelete(instance.id);
  };

  const ArrIcon = ARR_UI[instance.type].Icon;

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={tCommon(collapsed ? "expand" : "collapse")}
            aria-expanded={!collapsed}
            className="text-muted-foreground hover:text-foreground -ml-1 flex size-6 shrink-0 items-center justify-center rounded-sm transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </button>
          <ArrIcon
            className="text-muted-foreground size-5 shrink-0"
            aria-label={instance.type}
          />
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-1.5 font-medium">
              <InstanceConnectionDot instanceId={instance.id} />
              <span className="truncate">{instance.name}</span>
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {instance.url}
            </p>
            <p className="text-muted-foreground text-xs">
              {instance.searchesPerHour}
              {tForm("searchesPerHourSuffix")}
            </p>
          </div>
          {pendingCount > 0 && (
            <Badge
              variant="outline"
              title={tForm("queuedBadgeTooltip", {
                count: pendingCount,
                eta: formatEta(queue?.etaMs ?? 0, tTime),
              })}
              className="gap-1"
            >
              <Hourglass className="size-3" />
              {tForm("queuedBadge", { count: pendingCount })}
            </Badge>
          )}
          {failedCount > 0 && (
            <Badge variant="destructive">
              {failedCount} {tForm("failedBadge")}
            </Badge>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleTest}
              disabled={test.isPending}
              aria-label={tCommon("test")}
            >
              <Plug className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={onEdit}
              aria-label={tCommon("edit")}
            >
              <Edit2 className="size-4" />
            </Button>
            {/* Delete sits inside a kebab + confirm so the destructive
                action isn't a one-click neighbour of Test / Edit. */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="icon" />}
                aria-label={tCommon("moreActions")}
              >
                <MoreVertical className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={handleDelete}
                  disabled={deleteInstance.isPending}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-4" />
                  {tCommon("delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {!collapsed && (
          <>
            <div className="pt-subgroup border-t">
              <ShowAllMediaToggle instanceId={instance.id} />
            </div>
            <div className="pt-subgroup border-t">
              <AutoSearchSection instance={instance} />
            </div>
          </>
        )}
      </CardContent>
      {confirmDialog}
    </Card>
  );
}
