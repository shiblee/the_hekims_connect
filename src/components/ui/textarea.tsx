import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  const field = (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
  // With a maxLength, show a live "n / max" counter under the box.
  if (!props.maxLength) return field
  const length = typeof props.value === "string" ? props.value.length : 0
  const max = props.maxLength
  return (
    <div className="w-full">
      {field}
      <p className={cn(
        "mt-1 text-end text-[11px] tabular-nums",
        length >= max ? "text-destructive font-medium" : length >= max * 0.9 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
      )}>
        {length} / {max}
      </p>
    </div>
  )
}

export { Textarea }
