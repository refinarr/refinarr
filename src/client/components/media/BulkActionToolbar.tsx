"use client";
import { Button } from "@/client/components/ui/button";
import { Search, Trash2, EyeOff } from "lucide-react";

interface Props {
  selectedCount: number;
  onSearch: () => void;
  onDelete: (search: boolean) => void;
  onIgnore: () => void;
  disabled?: boolean;
}

export function BulkActionToolbar({ selectedCount, onSearch, onDelete, onIgnore, disabled }: Props) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-2 p-3 bg-accent rounded-md mb-4">
      <span className="text-sm font-medium">{selectedCount} selected</span>
      <div className="ml-auto flex gap-2">
        <Button size="sm" variant="outline" onClick={onSearch} disabled={disabled}>
          <Search className="h-4 w-4 mr-1" /> Search
        </Button>
        <Button size="sm" variant="outline" onClick={onIgnore} disabled={disabled}>
          <EyeOff className="h-4 w-4 mr-1" /> Ignore
        </Button>
        <Button size="sm" variant="outline" onClick={() => onDelete(false)} disabled={disabled}>
          <Trash2 className="h-4 w-4 mr-1 text-destructive" /> Delete
        </Button>
        <Button size="sm" variant="destructive" onClick={() => onDelete(true)} disabled={disabled}>
          <Trash2 className="h-4 w-4 mr-1" /> Delete & Search
        </Button>
      </div>
    </div>
  );
}
