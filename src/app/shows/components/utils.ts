import type { EpisodeFileEntry } from "@/shared/types/models";

export function groupBySeason(
  files: EpisodeFileEntry[],
): Map<number, EpisodeFileEntry[]> {
  const map = new Map<number, EpisodeFileEntry[]>();
  for (const f of files) {
    const list = map.get(f.seasonNumber) ?? [];
    list.push(f);
    map.set(f.seasonNumber, list);
  }
  return map;
}

export function filename(relativePath: string): string {
  return relativePath.split("/").pop() ?? relativePath;
}
