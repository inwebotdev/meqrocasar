import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

import { Icon } from "./Icon";

export type ButtonVariant = "primary" | "soft" | "accent" | "surface" | "circle";
export type ButtonSize = "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  trailingIcon?: string;
  fullWidth?: boolean;
  loading?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary font-label-lg text-label-lg shadow-lg active:scale-95",
  soft: "bg-primary/10 text-primary hover:bg-primary hover:text-on-primary font-label-sm text-label-sm",
  accent:
    "bg-gradient-to-r from-primary-container via-secondary to-primary text-on-primary font-label-md text-label-md shadow-sm",
  surface:
    "bg-surface-container-high hover:bg-surface-container-highest text-primary font-label-sm text-label-sm",
  circle: "bg-surface-container-high text-on-surface shadow-md",
};

const SIZE_CLASSES: Record<ButtonVariant, Record<ButtonSize, string>> = {
  primary: { md: "h-12 px-space-lg", lg: "h-14 px-space-xl" },
  soft: { md: "h-10 px-space-md", lg: "h-12 px-space-lg" },
  accent: { md: "h-10 px-space-md", lg: "h-12 px-space-lg" },
  surface: { md: "h-10 px-space-md", lg: "h-12 px-space-lg" },
  circle: { md: "w-12 h-12", lg: "w-14 h-14" },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    icon,
    trailingIcon,
    fullWidth = false,
    loading = false,
    disabled,
    className,
    children,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={props.type ?? "button"}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full outline-amber-bernal/30 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[variant][size],
        fullWidth && "w-full",
        (loading || disabled) && "pointer-events-none opacity-70",
        className,
      )}
      {...props}
    >
      {loading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      ) : (
        icon && <Icon name={icon} size={20} />
      )}
      {children}
      {!loading && trailingIcon && <Icon name={trailingIcon} size={20} />}
    </button>
  );
});
