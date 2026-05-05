import Papa from "papaparse";
import type { FlaggedMovie, FlaggedSeries } from "@/shared/types/models";

export function exportMoviesCsv(
  movies: FlaggedMovie[],
  filename = "movies.csv",
) {
  const rows = movies.map((m) => ({
    Title: m.title,
    Year: m.year,
    Score: (m.cfScore * 100).toFixed(0) + "%",
    MissingFormats: m.missingFormats.map((cf) => cf.name).join(", "),
    HasFile: m.hasFile ? "Yes" : "No",
  }));
  downloadCsv(rows, filename);
}

export function exportSeriesCsv(
  series: FlaggedSeries[],
  filename = "series.csv",
) {
  const rows = series.map((s) => ({
    Title: s.title,
    Year: s.year,
    Score: (s.cfScore * 100).toFixed(0) + "%",
    MissingFormats: s.missingFormats.map((cf) => cf.name).join(", "),
  }));
  downloadCsv(rows, filename);
}

function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
