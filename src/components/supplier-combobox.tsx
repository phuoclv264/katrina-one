

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

type SupplierComboboxProps = {
    suppliers: string[];
    value: string;
    onChange: (newValue: string) => void;
    disabled?: boolean;
}

export function SupplierCombobox({ suppliers, value, onChange, disabled }: SupplierComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(value === 'Chưa xác định' ? '' : value || "")

  React.useEffect(() => {
    setInputValue(value === 'Chưa xác định' ? '' : value || "")
  }, [value, open])

  const handleSelect = (currentValue: string) => {
    const newValue = currentValue === value ? "" : currentValue
    onChange(newValue)
    setInputValue(newValue)
    setOpen(false)
  }

  const handleAddNew = () => {
    if (inputValue && !suppliers.find(s => s.toLowerCase() === inputValue.toLowerCase())) {
        onChange(inputValue)
    }
    setOpen(false)
  }

  const displayValue = value && value !== 'Chưa xác định'
    ? suppliers.find((supplier) => supplier.toLowerCase() === value.toLowerCase()) || value
    : "Chọn NCC";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          <span className="truncate flex-1 text-left font-normal">{displayValue}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0"  onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
        <Command>
          <CommandInput 
            placeholder="Tìm hoặc thêm mới..."
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>
                <Button variant="ghost" className="w-full" onClick={handleAddNew}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Thêm "{inputValue}"
                </Button>
            </CommandEmpty>
            <CommandGroup className="max-h-48 overflow-y-auto">
              {suppliers.map((supplier) => (
                <CommandItem
                  key={supplier}
                  value={supplier}
                  onSelect={handleSelect}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value && value.toLowerCase() === supplier.toLowerCase() ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {supplier}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
