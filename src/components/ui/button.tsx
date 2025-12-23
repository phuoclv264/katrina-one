import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-pastel-blue text-zinc-900 shadow-sm hover:bg-pastel-blue/80 hover:shadow-md",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:shadow-md",
        outline:
          "border border-pastel-purple/50 bg-background shadow-sm hover:bg-pastel-purple/10 hover:text-zinc-900",
        secondary:
          "bg-pastel-mint text-zinc-900 shadow-sm hover:bg-pastel-mint/80 hover:shadow-md",
        ghost: "hover:bg-pastel-pink/20 text-zinc-900",
        link: "text-pastel-blue font-semibold underline-offset-4 hover:underline",
        // New variants inspired by staff dashboard samples
        gradient:
          "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20 hover:from-blue-500 hover:to-indigo-500 hover:shadow-blue-600/40",
        glass:
          "bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20",
        tile:
          "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white dark:bg-zinc-900 text-sm shadow-sm border border-zinc-100 dark:border-zinc-800 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all",
        chip:
          "rounded-full px-4 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-300 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-xl px-8",
        xl: "py-4 px-8 h-auto text-lg font-bold", // for large hero buttons
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
