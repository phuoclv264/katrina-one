
"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Save, X } from "lucide-react"
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
  const [tempSelected, setTempSelected] = React.useState<InventoryItem[]>([])

  React.useEffect(() => {
    if (open) {
      // When dialog opens, initialize tempSelected with items that match the selectedItems
      const initialSelectedInventory = selectedItems
        .map(item => inventoryItems.find(inv => inv.id === item.itemId)!)
        .filter(Boolean); // Filter out any undefined if an item is not found
      setTempSelected(initialSelectedInventory);
    }
  }, [open, selectedItems, inventoryItems])

  const handleSelect = (inventoryItem: InventoryItem) => {
    setTempSelected(prev => [...prev, inventoryItem].sort((a,b) => a.name.localeCompare(b.name, 'vi')));
  };
  
  const handleSave = () => {
    onChange(tempSelected);
    setOpen(false);
  }

  const handleRemoveTempItem = (indexToRemove: number) => {
    setTempSelected(prev => prev.filter((_, index) => index !== indexToRemove));
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
          <DialogTitle>Thêm mặt hàng vào phiếu chi</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 p-4">
            <div className="col-span-1">
                <Command>
                    <CommandInput placeholder="Tìm mặt hàng..." />
                    <CommandList className="max-h-[40vh]">
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
            </div>
            <div className="col-span-1 border rounded-md p-2">
                <h4 className="font-semibold text-sm mb-2">Sẽ thêm ({tempSelected.length})</h4>
                <div className="space-y-1 max-h-[40vh] overflow-y-auto">
                    {tempSelected.length > 0 ? tempSelected.map((item, index) => (
                        <Badge
                            key={`${item.id}-${index}`}
                            variant="secondary"
                            className="mr-1 mb-1 whitespace-normal h-auto justify-between w-full"
                          >
                            <span>{item.name}</span>
                            <button onClick={() => handleRemoveTempItem(index)} className="ml-2 rounded-full hover:bg-destructive/20 p-0.5">
                                <X className="h-3 w-3"/>
                            </button>
                        </Badge>
                    )) : <p className="text-xs text-muted-foreground text-center py-4">Chưa chọn mặt hàng nào.</p>}
                </div>
            </div>
        </div>
        <DialogFooter className="p-4 border-t">
          <DialogClose asChild>
            <Button variant="outline">Hủy</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={tempSelected.length === 0}>
            <Save className="mr-2 h-4 w-4" />
            Thêm {tempSelected.length} mặt hàng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
