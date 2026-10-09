import type { AnchorHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

import {
  BUTTON_SIZE_CLASSES,
  BUTTON_VARIANT_CLASSES,
  type ButtonSize,
  type ButtonVariant,
} from "./Button";
import { Icon } from "./Icon";

export interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  trailingIcon?: string;
  fullWidth?: boolean;
}

/** `Button`'s visual twin rendered as an `<a>`, for actions that are really navigation (downloads, mailto links, external links). */
export function LinkButton({
  variant = "primary",
  size = "md",
  icon,
  trailingIcon,
  fullWidth = false,
  className,
  children,
  ...props
}: LinkButtonProps) {
  return (
    <a
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-bernal/60",
        BUTTON_VARIANT_CLASSES[variant],
        BUTTON_SIZE_CLASSES[variant][size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {icon && <Icon name={icon} size={20} />}
      {children}
      {trailingIcon && <Icon name={trailingIcon} size={20} />}
    </a>
  );
}
