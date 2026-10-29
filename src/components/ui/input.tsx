import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground/70 selection:bg-primary selection:text-primary-foreground dark:bg-input/30 flex h-10 w-full min-w-0 rounded-[12px] border border-transparent bg-black/[0.04] px-3.5 py-1 text-[14.5px] tracking-[-0.01em] shadow-none transition-[color,background-color,border-color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-[14px]",
        "focus-visible:border-[#0071E3]/60 focus-visible:bg-white focus-visible:ring-[#0071E3]/30 focus-visible:ring-[4px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
