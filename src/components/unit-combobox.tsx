"use client"

import * as React from "react"
import { Check, ChevronsUpDown, PlusCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
} from "@/components/ui/popover"
import type { GlobalUnit } from "@/lib/types"

type UnitComboboxProps = {
    units: GlobalUnit[];
    value: string;
    onChange: (newValue: string) => void;
    onUnitsChange: (newUnits: GlobalUnit[]) => void;
    canManage: boolean;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
}

export function UnitCombobox({ 
    units = [],
    value, 
    onChange, 
    onUnitsChange,
    canManage,
    disabled,
    placeholder = "Chọn đơn vị...",
    className
}: UnitComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")

  React.useEffect(() => {
    if (!open) {
        setInputValue(value || "")
    } else {
        // Reset search input when opening, but keep the selected value
        setInputValue("")
    }
  }, [open, value])

  const handleSelect = (unitName: string) => {
    onChange(unitName)
    setInputValue(unitName)
    setOpen(false)
  }

  const handleAddNew = () => {
    if (inputValue && !units.find(u => u.name.toLowerCase() === inputValue.toLowerCase())) {
        const newUnit: GlobalUnit = { id: `unit-${Date.now()}`, name: inputValue };
        const newUnits = [...units, newUnit].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
        onUnitsChange(newUnits);
        onChange(newUnit.name);
    }
    setOpen(false);
  }

  const displayValue = value ? units.find((unit) => unit.name === value)?.name || value : placeholder;
  
  const sortedUnits = React.useMemo(() => [...units].sort((a,b) => a.name.localeCompare(b.name, 'vi')), [units]);

  const hasExactMatch = React.useMemo(() => 
    sortedUnits.some(unit => unit.name.toLowerCase() === inputValue.toLowerCase()),
    [sortedUnits, inputValue]
  );
  
  const showAddSuggestion = canManage && inputValue.trim() !== "" && !hasExactMatch;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          <span className="truncate flex-1 text-left font-normal">{displayValue}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" position="popper">
        <Command>
          <CommandInput 
            placeholder={canManage ? "Tìm hoặc thêm mới..." : "Tìm kiếm..."}
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandGroup>
              {sortedUnits.map((unit) => (
                <CommandItem
                  key={unit.id}
                  value={unit.name}
                  onSelect={() => handleSelect(unit.name)}
                >
                  <Check
                      className={cn(
                      "mr-2 h-4 w-4",
                      value === unit.name ? "opacity-100" : "opacity-0"
                      )}
                  />
                  {unit.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {showAddSuggestion && (
            <div className="p-2 border-t text-sm text-center text-muted-foreground">
                <p>Không tìm thấy đơn vị nào.</p>
                <Button variant="link" className="h-auto p-1 mt-1" onClick={handleAddNew}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Thêm đơn vị "{inputValue}"
                </Button>
            </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
