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

interface ComboboxProps {
    children: React.ReactNode
    value?: string
    onValueChange?: (value: string) => void
    open?: boolean
    onOpenChange?: (open: boolean) => void
    modal?: boolean
}

interface ComboboxContextType {
    value?: string
    onValueChange?: (value: string) => void
    open?: boolean
    onOpenChange?: (open: boolean) => void
    modal?: boolean
}

const ComboboxContext = React.createContext<ComboboxContextType | null>(null)

export function Combobox({
    children,
    value,
    onValueChange,
    open: controlledOpen,
    onOpenChange: controlledOnOpenChange,
    modal = false,
}: ComboboxProps) {
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
    const open = controlledOpen ?? uncontrolledOpen
    const onOpenChange = controlledOnOpenChange ?? setUncontrolledOpen

    return (
        <ComboboxContext.Provider value={{ value, onValueChange, open, onOpenChange, modal }}>
            <Popover open={open} onOpenChange={onOpenChange} modal={modal}>
                {children}
            </Popover>
        </ComboboxContext.Provider>
    )
}

export function ComboboxTrigger({
    children,
    className,
    asChild = false,
}: {
    children: React.ReactNode
    className?: string
    asChild?: boolean
}) {
    return (
        <PopoverTrigger asChild={asChild} className={className}>
            {children}
        </PopoverTrigger>
    )
}

export function ComboboxContent({
    children,
    className,
}: {
    children: React.ReactNode
    className?: string
}) {
    return (
        <PopoverContent className={cn("w-[200px] p-0", className)}>
            <Command>{children}</Command>
        </PopoverContent>
    )
}

export function ComboboxInput({
    placeholder = "Search...",
    className,
}: {
    placeholder?: string
    className?: string
}) {
    return <CommandInput placeholder={placeholder} className={className} />
}

export function ComboboxList({
    children,
    className,
}: {
    children: React.ReactNode
    className?: string
}) {
    return <CommandList className={className}>{children}</CommandList>
}

export function ComboboxEmpty({
    children,
    className,
}: {
    children: React.ReactNode
    className?: string
}) {
    return <CommandEmpty className={className}>{children}</CommandEmpty>
}

export function ComboboxGroup({
    children,
    className,
    heading,
}: {
    children: React.ReactNode
    className?: string
    heading?: string
}) {
    return (
        <CommandGroup className={className} heading={heading}>
            {children}
        </CommandGroup>
    )
}

export function ComboboxItem({
    children,
    value,
    onSelect,
    className,
}: {
    children: React.ReactNode
    value: string
    onSelect?: (value: string) => void
    className?: string
}) {
    const context = React.useContext(ComboboxContext)

    return (
        <CommandItem
            value={value}
            onSelect={(currentValue) => {
                onSelect?.(currentValue)
                context?.onValueChange?.(currentValue)
                context?.onOpenChange?.(false)
            }}
            className={className}
        >
            <Check
                className={cn(
                    "mr-2 h-4 w-4",
                    context?.value === value ? "opacity-100" : "opacity-0"
                )}
            />
            {children}
        </CommandItem>
    )
}
