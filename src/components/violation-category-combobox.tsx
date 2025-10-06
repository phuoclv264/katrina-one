
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
import type { IncidentCategory } from "@/lib/types"

type ViolationCategoryComboboxProps = {
    categories: string[];
    value: string;
    onChange: (newValue: string) => void;
    onCategoriesChange: (newCategories: string[]) => void;
    canManage: boolean;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
}

export function ViolationCategoryCombobox({ 
    categories = [],
    value, 
    onChange, 
    onCategoriesChange,
    canManage,
    disabled,
    placeholder = "Chọn loại vi phạm...",
    className
}: ViolationCategoryComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(value || "")

  React.useEffect(() => {
    if (!open) {
      setInputValue(value || "");
    } else {
      setInputValue("");
    }
  }, [open, value])

  const handleSelect = (currentValue: string) => {
    onChange(currentValue)
    setInputValue(currentValue)
    setOpen(false)
  }

  const handleAddNew = () => {
    if (inputValue && !categories.find(c => c.toLowerCase() === inputValue.toLowerCase())) {
        const newCategories = [...categories, inputValue].sort((a, b) => a.localeCompare(b, 'vi'));
        onCategoriesChange(newCategories);
        onChange(inputValue);
    }
    setInputValue("")
    setOpen(false);
  }
  
  const handleDelete = (e: React.MouseEvent, categoryToDelete: string) => {
      e.stopPropagation();
      const newCategories = categories.filter(c => c !== categoryToDelete);
      onCategoriesChange(newCategories);
      if(value === categoryToDelete) {
          onChange('');
      }
  }

  const displayValue = value ? categories.find((cat) => cat === value) || placeholder : placeholder;
  
  const sortedCategories = React.useMemo(() => 
    [...categories].filter(Boolean).sort((a,b) => a.localeCompare(b, 'vi')), 
  [categories]);

  const hasExactMatch = React.useMemo(() => 
    sortedCategories.some(cat => cat && cat.toLowerCase() === inputValue.toLowerCase()),
    [sortedCategories, inputValue]
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
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" position="popper"  onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
        <Command>
          <CommandInput 
            placeholder={canManage ? "Tìm hoặc thêm mới..." : "Tìm kiếm..."}
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>
                <div className="py-6 text-center text-sm">Không tìm thấy loại vi phạm.</div>
            </CommandEmpty>
            <CommandGroup className="max-h-48 overflow-y-auto">
                <CommandItem
                    key="all"
                    value=""
                    onSelect={() => handleSelect('')}
                >
                     <Check
                        className={cn(
                        "mr-2 h-4 w-4",
                        !value ? "opacity-100" : "opacity-0"
                        )}
                    />
                    Tất cả loại vi phạm
                </CommandItem>
              {sortedCategories.map((category) => (
                <CommandItem
                  key={category}
                  value={category}
                  onSelect={() => handleSelect(category)}
                  className="flex justify-between"
                >
                  <div className="flex items-center">
                    <Check
                        className={cn(
                        "mr-2 h-4 w-4",
                        value === category ? "opacity-100" : "opacity-0"
                        )}
                    />
                    {category}
                  </div>
                  {canManage && category !== "Khác" && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => handleDelete(e, category)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
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
                    Thêm loại vi phạm "{inputValue}"
                </Button>
            </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
