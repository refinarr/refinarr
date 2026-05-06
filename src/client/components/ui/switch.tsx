"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@/client/lib/utils";

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        // layout
        "peer group/switch relative inline-flex shrink-0 items-center",
        // shape
        "rounded-full border border-transparent",
        // motion
        "transition-all outline-none",
        // expanded hit area (after:* sits invisibly around the pill)
        "after:absolute after:-inset-x-3 after:-inset-y-2",
        // size variants
        "data-[size=default]:h-[18.4px] data-[size=default]:w-8",
        "data-[size=sm]:h-3.5 data-[size=sm]:w-6",
        // colors — track
        "data-checked:bg-primary", // ← teal/amber pill when "on"
        "data-unchecked:bg-input dark:data-unchecked:bg-input/80",
        // focus ring (uses --ring, which we tied to the brand)
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3",
        // invalid form state (red, intentionally not branded)
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:ring-3",
        "dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        // disabled
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          // base
          "pointer-events-none block rounded-full ring-0 transition-transform",
          // colors — thumb (light mode = white, dark mode flips by state)
          "bg-background",
          "dark:data-checked:bg-primary-foreground", // ← dark thumb on bright track in dark mode
          "dark:data-unchecked:bg-foreground",
          // size
          "group-data-[size=default]/switch:size-4",
          "group-data-[size=sm]/switch:size-3",
          // slide animation when checked
          "group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)]",
          "group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)]",
          // slide back when unchecked
          "group-data-[size=default]/switch:data-unchecked:translate-x-0",
          "group-data-[size=sm]/switch:data-unchecked:translate-x-0",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
