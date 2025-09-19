
"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
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

  const handleSelect = (inventoryItem: InventoryItem) => {
    const isSelected = selectedItems.some((selected) => selected.itemId === inventoryItem.id)
    if (isSelected) {
      const newSelectedInventory = selectedItems
        .filter((selected) => selected.itemId !== inventoryItem.id)
        .map(item => inventoryItems.find(inv => inv.id === item.itemId)!);
      onChange(newSelectedInventory)
    } else {
      const newSelectedInventory = [...selectedItems.map(item => inventoryItems.find(inv => inv.id === item.itemId)!), inventoryItem];
      onChange(newSelectedInventory);
    }
  }

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
                selectedItems.map((item) => (
                  <Badge
                    key={item.itemId}
                    variant="secondary"
                    className="mr-1 mb-1 whitespace-normal h-auto"
                  >
                    {item.name}
                  </Badge>
                ))
              ) : (
                <span className="font-normal text-muted-foreground">Chọn mặt hàng...</span>
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
              {inventoryItems.map((item) => {
                const isSelected = selectedItems.some(
                  (selected) => selected.itemId === item.id
                )
                return (
                  <CommandItem
                    key={item.id}
                    onSelect={() => handleSelect(item)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span>{item.name} <span className="text-xs text-muted-foreground">({item.category})</span></span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
