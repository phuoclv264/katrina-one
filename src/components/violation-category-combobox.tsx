
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
import type { ViolationCategory } from "@/lib/types"

type ViolationCategoryComboboxProps = {
    categories: ViolationCategory[];
    value: string;
    onChange: (newValue: string) => void;
    onCategoriesChange: (newCategories: ViolationCategory[]) => void;
    canManage: boolean;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
}

export function ViolationCategoryCombobox({ 
    categories = [], // Ensure categories is always an array
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
    setInputValue(value || "")
  }, [value, open])

  const handleSelect = (currentValue: string) => {
    onChange(currentValue)
    setInputValue(currentValue)
    setOpen(false)
  }

  const handleAddNew = () => {
    if (inputValue && !categories.find(c => c.toLowerCase() === inputValue.toLowerCase())) {
        const newCategories = [...categories, inputValue];
        onCategoriesChange(newCategories);
        onChange(inputValue);
    }
    setOpen(false);
  }
  
  const handleDelete = (e: React.MouseEvent, categoryToDelete: string) => {
      e.stopPropagation(); // Prevent dropdown from closing
      const newCategories = categories.filter(c => c !== categoryToDelete);
      onCategoriesChange(newCategories);
      // If the deleted category was the selected one, clear the selection
      if(value === categoryToDelete) {
          onChange('');
      }
  }

  const displayValue = value ? categories.find((cat) => cat === value) || placeholder : placeholder;

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
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput 
            placeholder={canManage ? "Tìm hoặc thêm mới..." : "Tìm kiếm..."}
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>
                {canManage ? (
                     <Button variant="ghost" className="w-full justify-start" onClick={handleAddNew}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Thêm "{inputValue}"
                    </Button>
                ) : (
                    <div className="py-6 text-center text-sm">Không tìm thấy loại vi phạm.</div>
                )}
            </CommandEmpty>
            <CommandGroup>
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
              {categories.map((category) => (
                <CommandItem
                  key={category}
                  value={category}
                  onSelect={handleSelect}
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
      </PopoverContent>
    </Popover>
  )
}
