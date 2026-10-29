import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-transparent placeholder:text-muted-foreground/70 focus-visible:border-[#0071E3]/60 focus-visible:bg-white focus-visible:ring-[#0071E3]/30 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-[12px] border bg-black/[0.04] px-3.5 py-2.5 text-[14.5px] tracking-[-0.01em] shadow-none transition-[color,background-color,border-color,box-shadow] outline-none focus-visible:ring-[4px] disabled:cursor-not-allowed disabled:opacity-50 md:text-[14px]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
