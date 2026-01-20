
"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

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
      className={cn(
        "fixed left-[50%] top-[50%] z-50 max-h-[90vh] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-lg",
        className
      )}
      {...props}
    >
      {children}
      {!hideClose && (
        <DialogPrimitive.Close className={cn(
          "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground",
          closeClassName
        )}>
          {closeElement ? closeElement : (<>
            <X className="h-4 w-4" />
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
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // Add a small vertical gap for stacked buttons and more horizontal spacing on wider screens
      "flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-0 sm:space-x-4",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
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
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

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
}
