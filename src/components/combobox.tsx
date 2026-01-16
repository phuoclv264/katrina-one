"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Plus, X, Trash2, Search } from "lucide-react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { cn, normalizeSearchString } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverPortal,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

export interface ComboboxOption {
  value: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
}

interface ComboboxProps {
  options: ComboboxOption[]
  value?: string | string[]
  onChange: (value: string | string[] | any) => void // relaxed type for flexibility
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  onCreate?: (value: string) => void
  onDelete?: (value: string) => void
  confirmDelete?: boolean
  deleteMessage?: string
  className?: string
  disabled?: boolean
  multiple?: boolean
  clearable?: boolean
  /**
   * Controls where the popover content is portaled.
   * - "auto": if inside an open Dialog, portal into the dialog container; otherwise portal to body (default).
   * - "body": always portal to body.
   */
  portalMode?: "auto" | "body"
  /** Force a specific portal container (overrides auto-detection when provided). */
  portalContainer?: HTMLElement | null
  /**
   * If true, renders a smaller, more compact version suitable for dense layouts or replacing Select.
   */
  compact?: boolean
  /**
   * If false, hides the search input. Useful for small lists where search is unnecessary.
   * @default true
   */
  searchable?: boolean
}

export function Combobox({
  options = [],
  value,
  onChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyText = "No option found.",
  onCreate,
  onDelete,
  confirmDelete = false,
  deleteMessage = "This action cannot be undone.",
  className,
  disabled = false,
  multiple = false,
  clearable = true,
  portalMode = "auto",
  portalContainer,
  compact = false,
  searchable = true,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")
  const triggerRef = React.useRef<HTMLDivElement | null>(null)
  const [resolvedPortalContainer, setResolvedPortalContainer] = React.useState<
    HTMLElement | null
  >(null)

  React.useEffect(() => {
    if (!open) return

    if (portalMode === "body") {
      setResolvedPortalContainer(null)
      return
    }

    if (portalContainer) {
      setResolvedPortalContainer(portalContainer)
      return
    }

    const triggerEl = triggerRef.current
    const dialogEl = triggerEl?.closest('[role="dialog"]') as HTMLElement | null
    setResolvedPortalContainer(dialogEl ?? null)
  }, [open, portalMode, portalContainer])

  const selectedValues = React.useMemo(() => {
    if (Array.isArray(value)) return value
    if (typeof value === "string" && value) return [value]
    return []
  }, [value])

  const handleSelect = (currentValue: string) => {
    if (multiple) {
      const newValues = selectedValues.includes(currentValue)
        ? selectedValues.filter((v) => v !== currentValue)
        : [...selectedValues, currentValue]
      onChange(newValues)
    } else {
      onChange(currentValue === value && clearable ? "" : currentValue)
      setOpen(false)
    }
  }

  const handleCreate = () => {
    if (onCreate && inputValue) {
      onCreate(inputValue)
      setInputValue("")
      // Keep open or close? Usually close or let user decide.
      // If multiple, maybe keep open.
      if (!multiple) setOpen(false)
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(multiple ? [] : "")
  }

  // Filter options based on input if needed, but Command does this automatically for rendered items.
  // However, for "Create" logic, we need to know if there's an exact match.
  const exactMatch = options.some(
    (option) => option.label.toLowerCase() === inputValue.toLowerCase()
  )

  return (
    <Popover modal={false} open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div ref={triggerRef} className={cn("relative", className)}>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between bg-background hover:bg-accent/50 transition-colors h-auto min-h-10 py-2",
              compact && "min-h-8 h-8 py-1 text-xs px-2",
              !selectedValues.length && "text-muted-foreground",
              className
            )}
            disabled={disabled}
          >
            <div className="flex flex-wrap gap-1.5 items-center overflow-hidden text-left">
              {selectedValues.length > 0 ? (
                multiple ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedValues.map((val) => {
                      const option = options.find((o) => o.value === val)
                      return (
                        <Badge
                          key={val}
                          variant="secondary"
                          className={cn(
                            "rounded-sm px-1.5 py-0.5 text-xs font-medium border border-border/50 bg-secondary/50 text-secondary-foreground hover:bg-secondary/70",
                            compact && "px-1 py-0 text-[10px] h-5 leading-none"
                          )}
                        >
                          {option?.label || val}
                        </Badge>
                      )
                    })}
                  </div>
                ) : (
                  <span className={cn("truncate font-medium text-foreground", compact && "text-xs")}>
                    {options.find((o) => o.value === selectedValues[0])?.label ||
                      selectedValues[0]}
                  </span>
                )
              ) : (
                <span className={cn("text-muted-foreground", compact && "text-xs")}>{placeholder}</span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              {clearable && selectedValues.length > 0 && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={handleClear}
                  className={cn(
                    "rounded-full p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors",
                    compact && "p-0.5"
                  )}
                >
                  <X className={cn("h-3.5 w-3.5", compact && "h-3 w-3")} />
                </div>
              )}
              <ChevronsUpDown className={cn("h-4 w-4 opacity-50", compact && "h-3 w-3")} />
            </div>
          </Button>
        </div>
      </PopoverTrigger>
      {(() => {
        const commandContent = (
          <Command
            className="border-none"
            filter={(value: string, search: string) => {
              if (!searchable) return 1
              const normalizedValue = normalizeSearchString(value ?? "")
              const normalizedSearch = normalizeSearchString(search ?? "")
              return normalizedValue.includes(normalizedSearch) ? 1 : 0
            }}
          >
            {searchable && (
              <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
                <CommandInput
                  placeholder={searchPlaceholder}
                  value={inputValue}
                  onValueChange={setInputValue}
                  className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-none focus:ring-0 px-0"
                  autoFocus
                />
              </div>
            )}
            <CommandList className="max-h-[240px] overflow-y-auto overflow-x-hidden p-1">
              <CommandEmpty className="py-6 text-center text-sm">
                {onCreate && inputValue && !exactMatch ? (
                  <div className="flex flex-col items-center gap-2 px-4">
                    <span className="text-muted-foreground">No results found.</span>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full h-8 text-xs"
                      onClick={handleCreate}
                    >
                      <Plus className="mr-2 h-3 w-3" />
                      Create "{inputValue}"
                    </Button>
                  </div>
                ) : (
                  <span className="text-muted-foreground">{emptyText}</span>
                )}
              </CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const isSelected = selectedValues.includes(option.value)
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onSelect={() => handleSelect(option.value)}
                      className={cn(
                        "flex items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground cursor-pointer my-0.5 transition-colors group",
                        isSelected && "bg-accent/50 font-medium"
                      )}
                    >
                      <div className="flex items-center flex-1 min-w-0">
                        <div
                          className={cn(
                            "mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary/30",
                            isSelected
                              ? "bg-primary border-primary text-primary-foreground"
                              : "opacity-30"
                          )}
                        >
                          <Check className={cn("h-3 w-3", isSelected ? "opacity-100" : "opacity-0")} />
                        </div>
                        {option.icon && (
                          <option.icon className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="truncate">{option.label}</span>
                      </div>
                      {onDelete && (
                        <div onClick={(e) => e.stopPropagation()} className="ml-2 shrink-0">
                          {confirmDelete ? (
                            <AlertDialog parentDialogTag="root">
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-aria-selected:opacity-100 transition-all"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete "{option.label}"?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {deleteMessage}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => onDelete(option.value)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-aria-selected:opacity-100 transition-all"
                              onClick={() => onDelete(option.value)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        )

        const contentProps = {
          className: "w-[--radix-popover-trigger-width] p-0 min-w-[200px]",
          style: { pointerEvents: "auto" as const },
          sideOffset: 4,
          align: "start" as const,
          onWheel: (e: React.WheelEvent) => e.stopPropagation(),
          onTouchMove: (e: React.TouchEvent) => e.stopPropagation(),
        }

        if (resolvedPortalContainer) {
          return (
            <PopoverPortal container={resolvedPortalContainer}>
              <PopoverPrimitive.Content
                {...contentProps}
                className={cn(
                  "z-50 rounded-lg border bg-popover text-popover-foreground shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
                  contentProps.className
                )}
              >
                {commandContent}
              </PopoverPrimitive.Content>
            </PopoverPortal>
          )
        }

        return <PopoverContent {...contentProps}>{commandContent}</PopoverContent>
      })()}
    </Popover>
  )
}

