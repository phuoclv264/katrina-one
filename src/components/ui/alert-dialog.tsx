"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent as BaseDialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog"

// Re-implement the AlertDialog API on top of the Dialog components so we no longer use
// @radix-ui/react-alert-dialog. This keeps the alert-style API but uses the shared Dialog
// implementation (which registers with the global overlay reset system).

type AlertDialogProps = Omit<React.ComponentPropsWithoutRef<typeof Dialog>, 'dialogTag' | 'parentDialogTag'> & {
  dialogTag?: string;
  // Parent dialog tag must be provided by callers so they explicitly set the
  // relationship between nested dialogs. Do not provide a default here.
  parentDialogTag: string;
};

const AlertDialog = (props: AlertDialogProps) => {
  // Note: we intentionally do NOT provide a default for parentDialogTag. Callers
  // must pass it explicitly so nested dialog relationships are clear.
  const { dialogTag = 'alert-dialog', parentDialogTag, ...rest } = props as any;
  // Dialog registers with useDialogBackHandler internally and requires tags
  return <Dialog dialogTag={dialogTag} parentDialogTag={parentDialogTag} {...(rest as any)} />;
}

const AlertDialogTrigger = DialogTrigger

const AlertDialogPortal = DialogPortal

const AlertDialogOverlay = DialogOverlay

type AlertDialogContentProps = React.ComponentPropsWithoutRef<typeof BaseDialogContent> & {
  // Optional container element to mount the portal into (passed to DialogPortal `container` prop).
  portalContainer?: Element | null;
};

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof BaseDialogContent>,
  AlertDialogContentProps
>(({ className, portalContainer, ...props }, ref) => (
  <BaseDialogContent ref={ref} portalContainer={portalContainer} className={cn(className)} {...props} />
))
AlertDialogContent.displayName = "AlertDialogContent"

const AlertDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
AlertDialogHeader.displayName = "AlertDialogHeader"

const AlertDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
AlertDialogFooter.displayName = "AlertDialogFooter"

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogTitle>,
  React.ComponentPropsWithoutRef<typeof DialogTitle>
>(({ className, ...props }, ref) => (
  <DialogTitle
    ref={ref}
    className={cn("text-lg font-semibold", className)}
    {...props}
  />
))
AlertDialogTitle.displayName = DialogTitle.displayName

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogDescription>,
  React.ComponentPropsWithoutRef<typeof DialogDescription>
>(({ className, ...props }, ref) => (
  <DialogDescription
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
AlertDialogDescription.displayName = DialogDescription.displayName

const AlertDialogAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  // Action does not auto-close by default. Keep it as a plain button so callers can
  // perform async work and close the dialog manually when appropriate.
  <button ref={ref} className={cn(buttonVariants(), className)} {...props} />
))
AlertDialogAction.displayName = "AlertDialogAction"

const AlertDialogCancel = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  // Cancel should close the dialog immediately
  <DialogClose asChild>
    <button ref={ref} className={cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0", className)} {...props} />
  </DialogClose>
))
AlertDialogCancel.displayName = "AlertDialogCancel"

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
