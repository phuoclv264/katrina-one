
"use client"

import * as React from "react"
import { Check, ChevronsUpDown, PlusCircle, Trash2 } from "lucide-react"

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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"


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

  const handleDelete = (e: React.MouseEvent, unitIdToDelete: string) => {
      e.stopPropagation(); // Prevent dropdown from closing
      const unitToDelete = units.find(u => u.id === unitIdToDelete);
      if (!unitToDelete) return;

      const newUnits = units.filter(u => u.id !== unitIdToDelete);
      onUnitsChange(newUnits);
      if(value === unitToDelete.name) {
          onChange('');
      }
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
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
        <Command>
          <CommandInput 
            placeholder={canManage ? "Tìm hoặc thêm mới..." : "Tìm kiếm..."}
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>
              <p className="py-6 text-center text-sm">Không tìm thấy đơn vị.</p>
            </CommandEmpty>
            <CommandGroup className="max-h-48 overflow-y-auto">
              {sortedUnits.map((unit) => (
                <CommandItem
                  key={unit.id}
                  value={unit.name}
                  onSelect={() => handleSelect(unit.name)}
                  className="flex justify-between items-center"
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
                   {canManage && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                           </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Xóa đơn vị "{unit.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Hành động này sẽ xóa vĩnh viễn đơn vị này khỏi hệ thống. Bạn có chắc chắn không?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Hủy</AlertDialogCancel>
                            <AlertDialogAction onClick={(e) => handleDelete(e, unit.id)}>Xóa</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {showAddSuggestion && (
            <div className="p-2 border-t text-sm text-center text-muted-foreground">
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
