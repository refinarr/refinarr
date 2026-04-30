"use client";
import { Slider } from "@/client/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";
import { Label } from "@/client/components/ui/label";

interface Filters {
  sortBy: "score" | "title" | "added";
  order: "asc" | "desc";
  maxScore: number;
}

interface Props {
  filters: Filters;
  onChange: (filters: Partial<Filters>) => void;
}

const SORT_LABELS: Record<Filters["sortBy"], string> = {
  score: "CF Score",
  title: "Title",
  added: "Added",
};

const ORDER_LABELS: Record<Filters["order"], string> = {
  asc: "Worst first",
  desc: "Best first",
};

export function FilterBar({ filters, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-4 mb-4">
      <div className="flex flex-col gap-1.5">
        <Label>Sort by</Label>
        <Select
          value={filters.sortBy}
          onValueChange={(v) => { if (v) onChange({ sortBy: v as Filters["sortBy"] }); }}
        >
          <SelectTrigger className="w-36">
            <SelectValue>{SORT_LABELS[filters.sortBy]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="score">CF Score</SelectItem>
            <SelectItem value="title">Title</SelectItem>
            <SelectItem value="added">Added</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Order</Label>
        <Select
          value={filters.order}
          onValueChange={(v) => { if (v) onChange({ order: v as "asc" | "desc" }); }}
        >
          <SelectTrigger className="w-36">
            <SelectValue>{ORDER_LABELS[filters.order]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="asc">Worst first</SelectItem>
            <SelectItem value="desc">Best first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5 min-w-48">
        <Label>Max score: {Math.round(filters.maxScore * 100)}%</Label>
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={[filters.maxScore]}
          onValueChange={(vals) => onChange({ maxScore: (vals as number[])[0] })}
        />
      </div>
    </div>
  );
}
