"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

/**
 * Reusable SearchableSelect (Combobox) component for searchable lookups.
 */
export function SearchableSelect({
  value,
  onValueChange,
  options = [],
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  disabled = false,
  className,
  error = false,
  modal = true,
}) {
  const [open, setOpen] = React.useState(false);

  // Normalize options array into { value, label, description }
  const normalizedOptions = React.useMemo(() => {
    return (options || []).map((opt) => {
      if (typeof opt === "string" || typeof opt === "number") {
        return { value: String(opt), label: String(opt) };
      }
      const val = String(opt.value ?? opt.id ?? "");
      const lbl = String(
        opt.label ??
          opt.name ??
          opt.description ??
          opt.code ??
          opt.rollNo ??
          opt.machineCode ??
          val
      );
      const desc = opt.description || opt.companyName || opt.code || opt.status || undefined;
      return { value: val, label: lbl, description: desc };
    });
  }, [options]);

  const selectedOption = React.useMemo(() => {
    return normalizedOptions.find((opt) => String(opt.value) === String(value));
  }, [normalizedOptions, value]);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={modal}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          type="button"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal text-left h-10 px-3 bg-background",
            !selectedOption && "text-muted-foreground",
            error && "border-destructive focus-visible:ring-destructive",
            className
          )}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0 z-[100] bg-popover text-popover-foreground shadow-md border"
        align="start"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-9" />
          <CommandList className="max-h-60 overflow-y-auto p-1">
            <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
              {emptyText}
            </CommandEmpty>
            <CommandGroup>
              {normalizedOptions.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label + " " + (opt.description || "") + " " + opt.value}
                  onSelect={() => {
                    const newValue = String(opt.value) === String(value) ? "" : String(opt.value);
                    onValueChange(newValue);
                    setOpen(false);
                  }}
                  className="cursor-pointer flex items-center justify-between px-2 py-1.5 rounded-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="truncate text-sm font-medium">{opt.label}</span>
                    {opt.description && (
                      <span className="text-xs text-muted-foreground truncate">
                        {opt.description}
                      </span>
                    )}
                  </div>
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      String(value) === String(opt.value) ? "opacity-100 text-primary" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
