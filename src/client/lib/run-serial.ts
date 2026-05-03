export interface RunSerialOptions {
  signal?: AbortSignal;
}

export type ProgressCallback = (current: number, total: number) => void;

export async function runSerial<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: ProgressCallback,
  options: RunSerialOptions = {},
): Promise<R[]> {
  const { signal } = options;
  const results: R[] = [];
  onProgress?.(0, items.length);
  for (let i = 0; i < items.length; i++) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    const r = await fn(items[i], i);
    results.push(r);
    onProgress?.(i + 1, items.length);
  }
  return results;
}
