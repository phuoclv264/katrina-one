'use client';

import * as React from 'react';
import { Check, Search, UserPlus, Plus } from 'lucide-react';
import { cn, normalizeSearchString } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
    PopoverPortal,
} from '@/components/ui/popover';
import { UserAvatar } from '@/components/user-avatar';
import { ManagedUser } from '@/lib/types';
import * as PopoverPrimitive from "@radix-ui/react-popover"

interface UserComboboxProps {
    users: ManagedUser[];
    selectedUids: string[];
    onSelect: (user: ManagedUser) => void;
    placeholder?: string;
    className?: string;
}

export function UserCombobox({
    users,
    selectedUids,
    onSelect,
    placeholder = "Thêm nhân viên...",
    className,
}: UserComboboxProps) {
    const [open, setOpen] = React.useState(false);
    const triggerRef = React.useRef<HTMLDivElement | null>(null);
    const [container, setContainer] = React.useState<HTMLElement | null>(null);

    React.useLayoutEffect(() => {
        if (open) {
            const dialogEl = triggerRef.current?.closest('[role="dialog"]') as HTMLElement | null;
            if (dialogEl) setContainer(dialogEl);
        }
    }, [open]);

    // Filter out already selected users and non-test accounts and sort using normalized displayName + role
    const availableUsers = React.useMemo(() => {
        const list = users
            .filter(u => !selectedUids.includes(u.uid) && !u.isTestAccount)
            .map(u => ({ user: u, norm: normalizeSearchString(`${u.displayName} ${u.role || ''}`) }));

        list.sort((a, b) => a.norm.localeCompare(b.norm));

        return list.map(item => item.user);
    }, [users, selectedUids]);

    const commandContent = (
        <Command 
            className="border-none"
            filter={(value, search) => {
                const normalizedValue = normalizeSearchString(value ?? "");
                const normalizedSearch = normalizeSearchString(search ?? "");
                return normalizedValue.includes(normalizedSearch) ? 1 : 0;
            }}
        >
            <div className="flex items-center px-3 border-b border-primary/5 bg-slate-50/50">
                <CommandInput 
                    placeholder="Tìm theo tên hoặc vai trò..." 
                    className="h-12 border-none ring-0 focus:ring-0 font-bold bg-transparent"
                    autoFocus
                />
            </div>
            <CommandList className="max-h-[300px]">
                <CommandEmpty className="py-10 text-center flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
                        <Search className="w-6 h-6 text-slate-200" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                        Không tìm thấy staff
                    </p>
                </CommandEmpty>
                <CommandGroup className="p-2">
                    {availableUsers.map((user) => (
                        <CommandItem
                            key={user.uid}
                            value={user.displayName + " " + user.role}
                            onSelect={() => {
                                onSelect(user);
                            }}
                            className="p-2 gap-3 cursor-pointer aria-selected:bg-primary/5 rounded-xl transition-colors mb-1 last:mb-0 group"
                        >
                            <UserAvatar user={user} size="h-9 w-9" rounded="lg" />
                            <div className="flex flex-col min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black text-slate-800">
                                        {user.displayName}
                                    </span>
                                </div>
                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none mt-0.5">
                                    {user.role}
                                </span>
                            </div>
                            <div className="w-6 h-6 rounded-full bg-primary/5 flex items-center justify-center opacity-0 group-aria-selected:opacity-100 transition-opacity">
                                <Plus className="w-3.5 h-3.5 text-primary" />
                            </div>
                        </CommandItem>
                    ))}
                </CommandGroup>
            </CommandList>
        </Command>
    );

    return (
        <Popover modal={false} open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <div ref={triggerRef} className={cn("relative w-full", className)}>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn(
                            "w-full justify-between h-12 rounded-2xl bg-white border-primary/5 hover:border-primary/20 hover:bg-white shadow-sm font-bold text-sm text-muted-foreground px-4"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center">
                                <UserPlus className="w-4 h-4 text-primary/60" />
                            </div>
                            <span>{placeholder}</span>
                        </div>
                        <Search className="h-4 w-4 shrink-0 opacity-30" />
                    </Button>
                </div>
            </PopoverTrigger>
            {container ? (
                <PopoverPortal container={container}>
                    <PopoverPrimitive.Content
                        className="w-[--radix-popover-trigger-width] p-0 rounded-2xl overflow-hidden shadow-2xl border border-primary/10 bg-white z-[9999]"
                        align="start"
                        sideOffset={8}
                        onWheel={(e) => e.stopPropagation()}
                        onTouchMove={(e) => e.stopPropagation()}
                        style={{ pointerEvents: 'auto' }}
                    >
                        {commandContent}
                    </PopoverPrimitive.Content>
                </PopoverPortal>
            ) : (
                <PopoverContent 
                    className="w-[--radix-popover-trigger-width] p-0 rounded-2xl overflow-hidden shadow-2xl border-primary/10"
                    align="start"
                    sideOffset={8}
                    onWheel={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                    style={{ pointerEvents: 'auto' }}
                >
                    {commandContent}
                </PopoverContent>
            )}
        </Popover>
    );
}

