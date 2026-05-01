import { Button } from "@/client/components/ui/button";
import { Search, EyeOff } from "lucide-react";

interface Props {
  onSearch: () => void;
  onIgnore: () => void;
  searchPending?: boolean;
  ignorePending?: boolean;
}

export function RowHoverActions({ onSearch, onIgnore, searchPending, ignorePending }: Props) {
  return (
    <div className="inline-flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        title="Trigger search"
        disabled={searchPending}
        onClick={onSearch}
      >
        <Search className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        title="Ignore"
        disabled={ignorePending}
        onClick={onIgnore}
      >
        <EyeOff className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
