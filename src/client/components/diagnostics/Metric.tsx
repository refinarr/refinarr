interface Props {
  label: string;
  value: string;
}

export function Metric({ label, value }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-muted-foreground text-xs tracking-wide uppercase">
        {label}
      </div>
      <div className="font-mono text-lg tabular-nums">{value}</div>
    </div>
  );
}
