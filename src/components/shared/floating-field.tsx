"use client";

import type { ComponentType, InputHTMLAttributes, ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-destructive">
      <AlertCircle className="h-4 w-4 shrink-0" /> {message}
    </p>
  );
}

/**
 * A text field whose label sits inside the box by default and floats up
 * onto the border on focus or once it has a value (the same field format
 * used across the site — admin login, Facility/Patient auth screens, etc).
 */
export function FloatingField({
  id,
  label,
  icon: Icon,
  error,
  endAdornment,
  className,
  ...inputProps
}: {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  error?: boolean;
  endAdornment?: ReactNode;
  className?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      {Icon && <Icon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />}
      <input
        id={id}
        placeholder=" "
        className={cn(
          "peer h-14 w-full rounded-lg border bg-transparent pr-3.5 text-base font-medium text-foreground outline-none transition-colors",
          Icon ? "pl-10" : "pl-3.5",
          endAdornment && "pr-11",
          error ? "border-destructive" : "border-input focus:border-primary",
          className
        )}
        {...inputProps}
      />
      <label
        htmlFor={id}
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 whitespace-nowrap bg-card px-1.5 text-base font-medium text-muted-foreground transition-all duration-150",
          Icon ? "left-10" : "left-3.5",
          "peer-focus:top-0 peer-focus:left-3 peer-focus:text-sm peer-focus:font-semibold",
          "peer-[&:not(:placeholder-shown)]:top-0 peer-[&:not(:placeholder-shown)]:left-3 peer-[&:not(:placeholder-shown)]:text-sm peer-[&:not(:placeholder-shown)]:font-semibold",
          error ? "text-destructive" : "peer-focus:text-primary"
        )}
      >
        {label}
      </label>
      {endAdornment}
    </div>
  );
}

/**
 * A Select dropdown styled to match FloatingField (icon-prefixed box, label
 * floated onto the border) so dropdowns and text fields read as one system.
 */
export function FloatingSelect({
  id,
  label,
  icon: Icon,
  error,
  value,
  onValueChange,
  placeholder,
  children,
}: {
  id?: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  error?: boolean;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      {Icon && <Icon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />}
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          id={id}
          className={cn(
            "!h-14 w-full rounded-lg border bg-transparent text-base font-medium",
            Icon ? "pl-10" : "pl-3.5",
            error ? "border-destructive" : "border-input"
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
      <label
        className={cn(
          "pointer-events-none absolute -top-2.5 z-10 whitespace-nowrap bg-card px-1.5 text-sm font-semibold",
          Icon ? "left-10" : "left-3",
          error ? "text-destructive" : "text-primary"
        )}
      >
        {label}
      </label>
    </div>
  );
}
