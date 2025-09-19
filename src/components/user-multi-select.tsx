
"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import type { ManagedUser, UserRole } from "@/lib/types"

type UserMultiSelectProps = {
  users: ManagedUser[]
  selectedUsers: ManagedUser[]
  onChange: (users: ManagedUser[]) => void
  disabled?: boolean
  className?: string
}

const roleOrder: Record<UserRole, number> = {
  'Phục vụ': 1,
  'Pha chế': 2,
  'Quản lý': 3,
  'Chủ nhà hàng': 4,
};


export function UserMultiSelect({
  users,
  selectedUsers,
  onChange,
  disabled,
  className,
}: UserMultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const handleSelect = (user: ManagedUser) => {
    const isSelected = selectedUsers.some((selected) => selected.uid === user.uid)
    if (isSelected) {
      onChange(selectedUsers.filter((selected) => selected.uid !== user.uid))
    } else {
      onChange([...selectedUsers, user])
    }
  }

  const handleUnselect = (user: ManagedUser) => {
    onChange(selectedUsers.filter((selected) => selected.uid !== user.uid))
  }
  
  const selectableUsers = React.useMemo(() => {
      return users
          .filter(u => u.role !== 'Chủ nhà hàng')
          .sort((a, b) => {
              const aIsSelected = selectedUsers.some(su => su.uid === a.uid);
              const bIsSelected = selectedUsers.some(su => su.uid === b.uid);

              if (aIsSelected && !bIsSelected) return -1;
              if (!aIsSelected && bIsSelected) return 1;

              const roleComparison = (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99);
              if (roleComparison !== 0) {
                  return roleComparison;
              }
              return a.displayName.localeCompare(b.displayName, 'vi');
          });
  }, [users, selectedUsers]);


  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn("relative", className)}>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between h-auto min-h-10", className)}
            onClick={() => !disabled && setOpen(!open)}
            disabled={disabled}
          >
            <div className="flex gap-1 flex-wrap">
              {selectedUsers.length > 0 ? (
                selectedUsers.map((user) => (
                  <Badge
                    key={user.uid}
                    variant="secondary"
                    className="mr-1"
                  >
                    {user.displayName}
                  </Badge>
                ))
              ) : (
                <span className="font-normal">Chọn nhân viên...</span>
              )}
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" position="popper">
        <Command>
          <CommandInput placeholder="Tìm nhân viên..." />
          <CommandList>
            <CommandEmpty>Không tìm thấy nhân viên.</CommandEmpty>
            <CommandGroup>
              {selectableUsers.map((user) => {
                const isSelected = selectedUsers.some(
                  (selected) => selected.uid === user.uid
                )
                return (
                  <CommandItem
                    key={user.uid}
                    onSelect={() => handleSelect(user)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {user.displayName}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
