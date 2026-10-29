"use client"

// ============================================================
// SearchInput & HighlightMatch — modern debounced search primitives.
// Provides 200ms debounce, keyboard shortcuts (/, Esc), clear button,
// and matching substring highlighting.
// ============================================================

import React, { useEffect, useRef, useState } from "react"
import { Loader2, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface DebouncedSearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  debounceMs?: number
  loading?: boolean
  totalResults?: number
  hasActiveFilters?: boolean
  onClearFilters?: () => void
}

export function DebouncedSearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className,
  debounceMs = 220,
  loading = false,
  totalResults,
  hasActiveFilters = false,
  onClearFilters,
}: DebouncedSearchInputProps) {
  const [localValue, setLocalValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync external changes
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Debounce emission
  useEffect(() => {
    const handler = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue)
      }
    }, debounceMs)
    return () => clearTimeout(handler)
  }, [localValue, onChange, debounceMs, value])

  // Keyboard shortcut: pressing "/" focuses input unless inside an input/textarea
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault()
        inputRef.current?.focus()
      } else if (e.key === "Escape" && document.activeElement === inputRef.current) {
        setLocalValue("")
        onChange("")
        inputRef.current?.blur()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onChange])

  function handleClear() {
    setLocalValue("")
    onChange("")
    inputRef.current?.focus()
  }

  const isFiltered = localValue.trim().length > 0 || hasActiveFilters

  return (
    <div className={cn("relative flex items-center", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-9.5 w-full rounded-xl border border-border/60 bg-muted/40 pl-9 pr-16 text-[13.5px] transition-all",
          "placeholder:text-muted-foreground/60 hover:bg-muted/60 focus:border-primary/50 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/15"
        )}
      />

      <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {localValue ? (
          <button
            type="button"
            onClick={handleClear}
            className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Clear search (Esc)"
          >
            <X className="h-3 w-3" />
          </button>
        ) : (
          <kbd className="hidden rounded border border-border/60 bg-muted/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/80 sm:inline-block">
            /
          </kbd>
        )}
      </div>

      {isFiltered && totalResults !== undefined && (
        <span className="sr-only">
          {totalResults} results found
        </span>
      )}
    </div>
  )
}

/**
 * Highlights matches of the query string in target text with a subtle accent background.
 */
export function HighlightMatch({ text, query }: { text: string | null | undefined; query: string }) {
  if (!text) return null
  const trimmed = query.trim()
  if (!trimmed) return <>{text}</>

  // Escape special regex chars
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const regex = new RegExp(`(${escaped})`, "gi")
  const parts = text.split(regex)

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="rounded bg-amber-400/25 px-0.5 font-medium text-foreground dark:bg-amber-400/30"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  )
}
