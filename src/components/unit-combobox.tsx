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
  const [inputValue, setInputValue] = React.useState(value || "")

  React.useEffect(() => {
    if (open) {
        setInputValue("")
    }
  }, [open])

  const handleSelect = (unitName: string) => {
    onChange(unitName)
    setOpen(false)
  }

  const handleAddNew = () => {
    if (inputValue && !units.find(u => u.name.toLowerCase() === inputValue.toLowerCase())) {
        const newUnit: GlobalUnit = { id: `unit-${Date.now()}`, name: inputValue };
        const newUnits = [...units, newUnit].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
        onUnitsChange(newUnits);
        onChange(newUnit.name); // Select the newly added unit
    }
    setInputValue("")
    setOpen(false);
  }

  const displayValue = value ? units.find((unit) => unit.name === value)?.name || placeholder : placeholder;
  
  const sortedUnits = React.useMemo(() => [...units].sort((a,b) => a.name.localeCompare(b.name, 'vi')), [units]);

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
            <CommandEmpty>
                {canManage && inputValue ? (
                     <Button variant="ghost" className="w-full justify-start" onClick={handleAddNew}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Thêm "{inputValue}"
                    </Button>
                ) : (
                    <div className="py-6 text-center text-sm">Không tìm thấy đơn vị.</div>
                )}
            </CommandEmpty>
            <CommandGroup>
              {sortedUnits.map((unit) => (
                <CommandItem
                  key={unit.id}
                  value={unit.name}
                  onSelect={() => handleSelect(unit.name)}
                  className="flex justify-between"
                >
                  <div className="flex items-center">
                    <Check
                        className={cn(
                        "mr-2 h-4 w-4",
                        value === unit.name ? "opacity-100" : "opacity-0"
                        )}
                    />
                    {unit.name}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
