
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog"

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
  const [inputValue, setInputValue] = React.useState("")

  React.useEffect(() => {
    if (!open) {
      setInputValue(value || "");
    } else {
      setInputValue("");
    }
  }, [open, value])

  const handleSelect = (categoryName: string) => {
    onChange(categoryName)
    setInputValue(categoryName)
    setOpen(false)
  }

  const handleAddNew = () => {
    if (inputValue && !categories.find(c => c.name.toLowerCase() === inputValue.toLowerCase())) {
        const newCategory: ViolationCategory = { id: `cat-${Date.now()}`, name: inputValue, severity: 'low', fineAmount: 0 };
        const newCategories = [...categories, newCategory].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
        onCategoriesChange(newCategories);
        onChange(newCategory.name);
    }
    setInputValue("")
    setOpen(false);
  }
  
  const handleDelete = (e: React.MouseEvent, categoryId: string) => {
      e.stopPropagation();
      const categoryToDelete = categories.find(c => c.id === categoryId);
      if (!categoryToDelete) return;

      const newCategories = categories.filter(c => c.id !== categoryId);
      onCategoriesChange(newCategories);
      if(value === categoryToDelete.name) {
          onChange('');
      }
  }

  const displayValue = value ? categories.find((cat) => cat.name === value)?.name || placeholder : placeholder;
  
  const sortedCategories = React.useMemo(() => 
    [...categories].filter(Boolean).sort((a,b) => a.name.localeCompare(b, 'vi')), 
  [categories]);

  const hasExactMatch = React.useMemo(() => 
    sortedCategories.some(cat => cat.name.toLowerCase() === inputValue.toLowerCase()),
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
                  {canManage && category.name !== "Khác" && (
                     <AlertDialog>
                      <AlertDialogTrigger asChild>
                         <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
                           <Trash2 className="h-4 w-4 text-destructive" />
                         </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                           <AlertDialogTitle>Xóa loại vi phạm "{category.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>Hành động này sẽ xóa vĩnh viễn danh mục này. Bạn có chắc không?</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Hủy</AlertDialogCancel>
                          <AlertDialogAction onClick={(e) => handleDelete(e, category.id)}>Xóa</AlertDialogAction>
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
                    Thêm loại vi phạm "{inputValue}"
                </Button>
            </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
