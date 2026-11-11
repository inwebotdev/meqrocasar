import { cn } from "@/lib/cn";

export type SwatchTone = "light" | "dark";

export interface SwatchProps {
  hex: string;
  name: string;
  tone: SwatchTone;
  className?: string;
}

const BLOCK_TONE_CLASSES: Record<SwatchTone, string> = {
  light: "h-7",
  dark: "h-9",
};

const LABEL_TONE_CLASSES: Record<SwatchTone, string> = {
  light: "text-on-surface",
  dark: "text-on-primary",
};

const NAME_TONE_CLASSES: Record<SwatchTone, string> = {
  light: "text-on-surface-variant",
  dark: "text-on-primary/75",
};

export function Swatch({ hex, name, tone, className }: SwatchProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 rounded-md p-1 text-center",
        tone === "light" && "bg-surface-container-lowest shadow-md",
        className,
      )}
    >
      <div
        className={cn("w-full rounded shadow-inner", BLOCK_TONE_CLASSES[tone])}
        style={{ backgroundColor: hex }}
      />
      <span
        className={cn(
          "w-full truncate font-label-sm text-label-sm font-bold",
          LABEL_TONE_CLASSES[tone],
        )}
      >
        {hex}
      </span>
      <span className={cn("w-full truncate text-[9px]", NAME_TONE_CLASSES[tone])}>{name}</span>
    </div>
  );
}
