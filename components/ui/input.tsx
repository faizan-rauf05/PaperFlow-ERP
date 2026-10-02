import * as React from 'react'

import { cn } from '@/lib/utils'

// Native pickers otherwise open only from the small calendar/clock icon.
const PICKER_TYPES = new Set(['date', 'datetime-local', 'month', 'week', 'time'])

function Input({ className, type, onClick, ...props }: React.ComponentProps<'input'>) {
  const hasPicker = !!type && PICKER_TYPES.has(type)

  const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    onClick?.(e)
    if (!hasPicker || e.defaultPrevented) return
    const input = e.currentTarget
    if (input.disabled || input.readOnly) return
    try {
      input.showPicker?.()
    } catch {
      // Unsupported browser or blocked context — the icon still works.
    }
  }

  return (
    <input
      type={type}
      data-slot="input"
      onClick={handleClick}
      className={cn(
        hasPicker && 'cursor-pointer',
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
