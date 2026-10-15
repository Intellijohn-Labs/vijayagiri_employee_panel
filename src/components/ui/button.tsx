"use client";

import { forwardRef, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { springFirm } from "@/lib/motion";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconOnly?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.18)] hover:bg-accent-hover hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_0_0_3px_var(--accent-glow)]",
  secondary: "border border-line bg-surface text-fg shadow-card hover:border-strong hover:bg-hover",
  ghost: "text-muted hover:bg-hover hover:text-fg",
  danger: "border border-danger/25 bg-danger-tint text-danger hover:bg-danger/20",
};

const sizes: Record<Size, string> = {
  sm: "h-7 gap-1.5 rounded-md px-2.5 text-xs",
  md: "h-8 gap-2 rounded-md px-3 text-[13px]",
  lg: "h-9 gap-2 rounded-lg px-4 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, iconOnly, leading, trailing, className, children, disabled, ...rest },
  ref,
) {
  const off = disabled || loading;
  return (
    <motion.button
      ref={ref}
      whileTap={off ? undefined : { scale: 0.98 }}
      transition={springFirm}
      disabled={off}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium transition-[background-color,border-color,color,box-shadow] duration-150",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        iconOnly && (size === "sm" ? "w-7 px-0" : size === "lg" ? "w-9 px-0" : "w-8 px-0"),
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : leading}
      {children}
      {!loading && trailing}
    </motion.button>
  );
});
