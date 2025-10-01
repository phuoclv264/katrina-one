
"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Save } from "lucide-react"
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import type { InventoryItem, ExpenseItem } from "@/lib/types"

type ItemMultiSelectProps = {
  inventoryItems: InventoryItem[]
  selectedItems: ExpenseItem[]
  onChange: (items: InventoryItem[]) => void
  disabled?: boolean
  className?: string
}

export function ItemMultiSelect({
  inventoryItems,
  selectedItems,
  onChange,
  disabled,
  className,
}: ItemMultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [tempSelected, setTempSelected] = React.useState<ExpenseItem[]>(selectedItems)

  React.useEffect(() => {
    if (open) {
      setTempSelected(selectedItems)
    }
  }, [open, selectedItems])

  const handleSelect = (inventoryItem: InventoryItem) => {
    const newExpenseItem: ExpenseItem = {
      itemId: inventoryItem.id,
      name: inventoryItem.name,
      supplier: inventoryItem.supplier,
      unit: inventoryItem.units.find(u => !u.isBaseUnit)?.name || inventoryItem.baseUnit, // Default to order unit or base unit
      quantity: 1,
      unitPrice: 0,
    };
    setTempSelected(prev => [...prev, newExpenseItem]);
  };
  
  const handleSave = () => {
    const newSelectedInventory = tempSelected.map(item => inventoryItems.find(inv => inv.id === item.itemId)!).filter(Boolean);
    onChange(newSelectedInventory);
    setOpen(false);
  }

  const selectableItems = React.useMemo(() => {
      return (inventoryItems || []).sort((a,b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }, [inventoryItems]);


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className={cn("relative", className)}>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between h-auto min-h-10", className)}
            disabled={disabled}
          >
            <div className="flex gap-1 flex-wrap">
              {selectedItems.length > 0 ? (
                selectedItems.map((item, index) => (
                  <Badge
                    key={`${item.itemId}-${index}`}
                    variant="secondary"
                    className="mr-1 mb-1 whitespace-normal h-auto bg-card text-card-foreground"
                  >
                    {item.name}
                  </Badge>
                ))
              ) : (
                <span className="font-normal text-muted-foreground">Chọn mặt hàng thủ công...</span>
              )}
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </div>
      </DialogTrigger>
      <DialogContent className="p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Chọn mặt hàng</DialogTitle>
        </DialogHeader>
        <Command>
          <CommandInput placeholder="Tìm mặt hàng..." />
          <CommandList>
            <CommandEmpty>Không tìm thấy mặt hàng.</CommandEmpty>
            <CommandGroup>
              {selectableItems.map((item) => {
                return (
                  <CommandItem
                    key={item.id}
                    onSelect={() => handleSelect(item)}
                  >
                    <span>{item.name} <span className="text-xs text-muted-foreground">({item.category})</span></span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        <DialogFooter className="p-4 border-t">
          <DialogClose asChild>
            <Button variant="outline">Hủy</Button>
          </DialogClose>
          <Button onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            Lưu lựa chọn ({tempSelected.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
