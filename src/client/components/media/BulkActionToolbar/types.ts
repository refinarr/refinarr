export type BulkAction = "search" | "ignore" | "delete";

export interface BulkProgress {
  current: number;
  total: number;
  action: BulkAction;
}
