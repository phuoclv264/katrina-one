
"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X, Loader2, LayoutGrid, User, Camera, File as FileIcon, Trash2, Wallet, Calendar, Clock, AlertTriangle, Trophy, Maximize2, MessageSquareText, Check, Paperclip, Lock, Info, Send, History, NotebookPen, FileEdit, Calculator } from "lucide-react"

import { cn } from "@/lib/utils";
import { useDialogBackHandler } from "@/contexts/dialog-context";

type OurDialogProps = DialogPrimitive.DialogProps & {
  // Tag to identify this dialog (required). Use a unique string per logical dialog type.
  dialogTag: string;
  // Tag of the parent dialog that opened this dialog (required). For top-level dialogs, use 'root' or similar.
  parentDialogTag: string;
};

const Dialog = (props: OurDialogProps) => {
  const { open, onOpenChange, dialogTag, parentDialogTag, ...rest } = props;
  useDialogBackHandler(open ?? false, onOpenChange ?? (() => { }), { tag: dialogTag, parentTag: parentDialogTag });
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} {...(rest as DialogPrimitive.DialogProps)} />;
};

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  // Optional container element to mount the portal into (passed to Radix Portal `container` prop).
  portalContainer?: Element | null;
  // Optional class name to apply to the overlay (useful for transparent overlays per-dialog)
  overlayClassName?: string;
  // Hide the default X close button rendered in the top-right corner
  hideClose?: boolean;
  // Provide a custom React node to render inside the Close button (e.g., custom icon)
  closeElement?: React.ReactNode;
  // Optional className to apply to the Close button wrapper for custom styling
  closeClassName?: string;
};

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, portalContainer, overlayClassName, hideClose, closeElement, closeClassName, ...props }, ref) => (
  <DialogPortal container={portalContainer}>
    <DialogOverlay className={overlayClassName} />
    <DialogPrimitive.Content
      ref={ref}
      onInteractOutside={(e: any) => e.preventDefault()}
      onPointerDownOutside={(e: any) => e.preventDefault()}
      onFocusOutside={(e: any) => e.preventDefault()}
      aria-describedby={undefined}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 max-h-[90vh] grid w-full max-w-[95dvw] sm:max-w-lg translate-x-[-50%] translate-y-[-50%] gap-0 border-none bg-card shadow-soft duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-[2.5rem] overflow-hidden sm:max-w-lg",
        className
      )}
      {...props}
    >
      <div className="flex flex-col max-h-[90vh]">
        {children}
      </div>
      {!hideClose && (
        <DialogPrimitive.Close className={cn(
          "absolute right-5 top-5 rounded-full p-2 text-muted-foreground/50 transition-all hover:text-foreground hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none bg-background/20 backdrop-blur-md z-50",
          closeClassName
        )}>
          {closeElement ? closeElement : (<>
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </>)}
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  variant = "default",
  glowColor,
  children,
  icon,
  iconkey,
  hideicon=false,
  ...props
} : React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "premium" | "warning" | "info" | "destructive" | "success";
  glowColor?: string;
  /** Optional leading icon (defaults to a neutral grid icon) */
  icon?: React.ReactNode;
  /** Keyword to select a semantic icon from the central map (preferred over stringly importing icons) */
  iconkey?: string;
  hideicon?: boolean;
}) => {
  // icon color / background mapping per header variant
  const iconVariant = {
    default: "bg-primary/5 text-primary",
    premium: "bg-primary/10 text-primary",
    warning: "bg-amber-50/90 text-amber-600",
    info: "bg-sky-50/90 text-sky-600",
    destructive: "bg-red-50/90 text-rose-600",
    success: "bg-emerald-50/90 text-emerald-600",
  }[variant];

  // Centralized iconKey -> lucide component map (use semantic keys across the repo)
  const iconMap: Record<string, React.ReactNode> = {
    layout: <LayoutGrid className="h-6 w-6" />,
    user: <User className="h-6 w-6" />,
    camera: <Camera className="h-6 w-6" />,
    file: <FileIcon className="h-6 w-6" />,
    edit: <FileEdit className="h-6 w-6" />,
    trash: <Trash2 className="h-6 w-6" />,
    wallet: <Wallet className="h-6 w-6" />,
    calendar: <Calendar className="h-6 w-6" />,
    calculator: <Calculator className="h-6 w-6" />,
    clock: <Clock className="h-6 w-6" />,
    alert: <AlertTriangle className="h-6 w-6" />,
    trophy: <Trophy className="h-6 w-6" />,
    maximize: <Maximize2 className="h-6 w-6" />,
    message: <MessageSquareText className="h-6 w-6" />,
    check: <Check className="h-6 w-6" />,
    paperclip: <Paperclip className="h-6 w-6" />,
    lock: <Lock className="h-6 w-6" />,
    info: <Info className="h-6 w-6" />,
    send: <Send className="h-6 w-6" />,
    history: <History className="h-6 w-6" />,
    event: <NotebookPen className="h-6 w-6" />,
  };


  const variantStyles = {
    default: "bg-gradient-to-br from-primary/12 via-primary/6 to-primary/2 text-foreground",
    premium: "bg-gradient-to-br from-primary/30 via-primary/15 to-primary/8 text-foreground border-b border-primary/10",
    warning: "bg-gradient-to-br from-amber-50/80 via-amber-50/40 to-transparent text-amber-950",
    info: "bg-gradient-to-br from-sky-50/80 via-blue-50/40 to-transparent text-sky-950",
    destructive: "bg-gradient-to-br from-red-50/80 via-rose-50/40 to-transparent text-red-950",
    success: "bg-gradient-to-br from-emerald-50/80 via-green-50/40 to-transparent text-emerald-950",
  };

  const defaultGlow = {
    default: "bg-gradient-to-br from-primary/20 to-primary/5",
    premium: "bg-gradient-to-br from-primary/40 to-primary/15",
    warning: "bg-gradient-to-br from-amber-300/30 to-amber-200/10",
    info: "bg-gradient-to-br from-sky-300/30 to-blue-200/10",
    destructive: "bg-gradient-to-br from-red-300/30 to-rose-200/10",
    success: "bg-gradient-to-br from-emerald-300/30 to-green-200/10",
  }[variant];

  return (
    <div
      className={cn(
        "flex flex-col space-y-2.5 p-6 pr-16 sm:px-8 sm:pr-16 text-center sm:text-left border-b border-primary/6 relative overflow-hidden shrink-0",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      <div className="relative z-10">
        <div className="flex items-center gap-4 justify-start sm:justify-start">
          {!hideicon && (
            <div className={cn("p-3 rounded-lg flex items-center justify-start shrink-0", iconVariant)} aria-hidden="true">
              {icon ?? (iconkey ? iconMap[iconkey] ?? <LayoutGrid className="h-6 w-6" /> : <LayoutGrid className="h-6 w-6" />)}
            </div>
          )}

          <div className="flex flex-col space-y-1.5 text-center sm:text-left min-w-0">
            {children}
          </div>
        </div>
      </div>
      {/* Universal Decorative Glow */}
      <div className={cn(
        "absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-60",
        glowColor || defaultGlow
      )} />
    </div>
  );
};
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "muted";
}) => {
  const variantStyles = {
    default: "bg-transparent",
    muted: "bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800",
  };

  return (
    <div
      className={cn(
        "flex flex-row justify-end items-center gap-3 p-6 pt-4",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
};
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-xl font-semibold leading-snug tracking-normal font-headline text-foreground",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground/80 leading-relaxed font-normal", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

const DialogBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex-1 overflow-y-auto px-6 py-4",
      className
    )}
    {...props}
  />
)
DialogBody.displayName = "DialogBody"

// Standardized Action Buttons for Dialogs
const DialogAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { 
    variant?: "default" | "destructive" | "secondary" | "outline" | "ghost" | "pastel-blue" | "pastel-mint" | "pastel-purple";
    size?: "default" | "sm" | "lg" | "icon";
    isLoading?: boolean;
  }
>(({ className, variant = "default", size = "default", isLoading, children, ...props }, ref) => {
  const variantClass = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    outline: "border-2 border-input bg-background hover:bg-accent hover:text-accent-foreground",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    "pastel-blue": "bg-pastel-blue text-slate-900 border border-black/5 hover:scale-[1.02] shadow-sm",
    "pastel-mint": "bg-pastel-mint text-slate-900 border border-black/5 hover:scale-[1.02] shadow-sm",
    "pastel-purple": "bg-pastel-purple text-slate-900 border border-black/5 hover:scale-[1.02] shadow-sm",
  }[variant];

  const sizeClass = {
    default: "h-12 px-5 rounded-2xl",
    sm: "h-9 px-3 rounded-xl",
    lg: "h-14 px-8 rounded-[20px]",
    icon: "h-10 w-10 rounded-xl",
  }[size];

  return (
    <button
      ref={ref}
      className={cn(
        "font-bold transition-all duration-200 active:scale-[0.98] focus:outline-none flex items-center justify-center gap-2 text-sm",
        variantClass,
        sizeClass,
        className
      )}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
})
DialogAction.displayName = "DialogAction"

const DialogCancel = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <DialogClose asChild>
    <button
      ref={ref}
      className={cn(
        "h-12 px-5 rounded-2xl font-bold bg-muted/40 text-muted-foreground hover:bg-muted/60 transition-all duration-200 active:scale-[0.98] focus:outline-none border border-transparent hover:border-border",
        className
      )}
      {...props}
    />
  </DialogClose>
))
DialogCancel.displayName = "DialogCancel"

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogAction,
  DialogCancel,
}

