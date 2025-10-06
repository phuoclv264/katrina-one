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

type IncidentCategoryComboboxProps = {
    categories: IncidentCategory[];
    value: string;
    onChange: (newValue: string) => void;
    onCategoriesChange: (newCategories: IncidentCategory[]) => void;
    canManage: boolean;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
}

export function IncidentCategoryCombobox({ 
    categories = [],
    value, 
    onChange, 
    onCategoriesChange,
    canManage,
    disabled,
    placeholder = "Chọn loại sự cố...",
    className
}: IncidentCategoryComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")

  const handleSelect = (categoryName: string) => {
    onChange(categoryName)
    setOpen(false)
  }

  const handleAddNew = () => {
    if (inputValue && !categories.find(c => c.name.toLowerCase() === inputValue.toLowerCase())) {
        const newCategory: IncidentCategory = { id: `cat-${Date.now()}`, name: inputValue };
        const newCategories = [...categories, newCategory].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
        onCategoriesChange(newCategories);
        onChange(newCategory.name); // Select the newly added category
    }
    setInputValue("")
    setOpen(false);
  }
  
  const handleDelete = (e: React.MouseEvent, categoryId: string) => {
      e.stopPropagation(); // Prevent dropdown from closing
      const categoryToDelete = categories.find(c => c.id === categoryId);
      if (!categoryToDelete) return;
      const newCategories = categories.filter(c => c.id !== categoryId);
      onCategoriesChange(newCategories);
      if(value === categoryToDelete.name) {
          onChange('');
      }
  }

  const displayValue = value ? categories.find((cat) => cat.name === value)?.name || placeholder : placeholder;
  
  const sortedCategories = React.useMemo(() => [...categories].sort((a,b) => a.name.localeCompare(b.name, 'vi')), [categories]);

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
                {canManage && inputValue ? (
                     <Button variant="ghost" className="w-full justify-start" onClick={handleAddNew}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Thêm "{inputValue}"
                    </Button>
                ) : (
                    <div className="py-6 text-center text-sm">Không tìm thấy loại sự cố.</div>
                )}
            </CommandEmpty>
            <CommandGroup className="max-h-48 overflow-y-auto">
              {sortedCategories.map((category) => (
                <CommandItem
                  key={category.id}
                  value={category.name}
                  onSelect={() => handleSelect(category.name)}
                  className="flex justify-between"
                >
                  <div className="flex items-center">
                    <Check
                        className={cn(
                        "mr-2 h-4 w-4",
                        value === category.name ? "opacity-100" : "opacity-0"
                        )}
                    />
                    {category.name}
                  </div>
                  {canManage && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => handleDelete(e, category.id)}>
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
