import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "focus-ring h-11 w-full rounded-2xl border border-border bg-panel px-4 text-sm transition-[border-color,box-shadow] placeholder:text-muted-foreground/70",
        className,
      )}
      {...rest}
    />
  );
});
