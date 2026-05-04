import { cn } from "@/client/lib/utils";

interface Props {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
}

const SIZES = {
  sm: { mark: 18, text: "text-sm" },
  md: { mark: 22, text: "text-base" },
  lg: { mark: 24, text: "text-lg" },
} as const;

export function Logo({ size = "md", showWordmark = true, className }: Props) {
  const { mark, text } = SIZES[size];
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        width={mark}
        height={mark}
        viewBox="0 0 32 32"
        aria-hidden
        focusable="false"
      >
        <rect width="32" height="32" rx="7" className="fill-brand" />
        <path
          className="fill-foreground-on-brand"
          fillRule="evenodd"
          d="M9 6h8.5a5.5 5.5 0 0 1 3 10l3.5 10h-3.5l-3.2-9H12.5v9H9V6Zm3.5 3v5H17a2.5 2.5 0 0 0 0-5h-4.5Z"
        />
      </svg>
      {showWordmark && (
        <span className={cn("font-bold tracking-tight", text)}>
          Refin<span className="text-brand">arr</span>
        </span>
      )}
    </span>
  );
}
