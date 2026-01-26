"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { LucideIcon, Info, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';
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

const variantStyles = {
  primary: {
    glow: "bg-blue-500/10",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-500",
    iconHalo: "bg-blue-500",
    button: "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25",
    title: "text-white",
    description: "text-zinc-400"
  },
  destructive: {
    glow: "bg-rose-500/10",
    iconBg: "bg-rose-500/10",
    iconColor: "text-rose-500",
    iconHalo: "bg-rose-500",
    button: "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/25",
    title: "text-white",
    description: "text-zinc-400"
  },
  warning: {
    glow: "bg-amber-500/10",
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-500",
    iconHalo: "bg-amber-500",
    button: "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/25",
    title: "text-white",
    description: "text-zinc-400"
  }
};

const AlertDialogContext = React.createContext<{
  variant: 'primary' | 'destructive' | 'warning';
}>({ variant: 'primary' });

// Re-implement the AlertDialog API on top of the Dialog components so we no longer use
// @radix-ui/react-alert-dialog. This keeps the alert-style API but uses the shared Dialog
// implementation (which registers with the global overlay reset system).

type AlertDialogProps = Omit<React.ComponentPropsWithoutRef<typeof Dialog>, 'dialogTag' | 'parentDialogTag'> & {
  variant?: 'primary' | 'destructive' | 'warning';
  dialogTag?: string;
  // When true the header icon (the decorative square) will be hidden.
  // Useful for compact dialogs or when the caller renders a custom leading element.
  hideicon?: boolean;
  icon?: React.ReactNode;
  // Parent dialog tag must be provided by callers so they explicitly set the
  // relationship between nested dialogs. Do not provide a default here.
  parentDialogTag?: string;
};

const AlertDialog = (props: AlertDialogProps) => {
  const { variant = 'primary', dialogTag = 'alert-dialog', parentDialogTag = 'root', ...rest } = props;
  return (
    <AlertDialogContext.Provider value={{ variant }}>
      <Dialog dialogTag={dialogTag} parentDialogTag={parentDialogTag} {...rest} />
    </AlertDialogContext.Provider>
  );
}

const AlertDialogTrigger = DialogTrigger

const AlertDialogPortal = DialogPortal

const AlertDialogOverlay = DialogOverlay

type AlertDialogContentProps = React.ComponentPropsWithoutRef<typeof BaseDialogContent> & {
  // Optional container element to mount the portal into (passed to DialogPortal `container` prop).
  portalContainer?: Element | null;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
};

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl'
};

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof BaseDialogContent>,
  AlertDialogContentProps
>(({ className, portalContainer, maxWidth = 'md', children, ...props }, ref) => {
  const { variant } = React.useContext(AlertDialogContext);

  return (
    <BaseDialogContent
      ref={ref}
      portalContainer={portalContainer}
      className={cn(
        "rounded-[2.5rem] p-0 overflow-hidden border-none shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] bg-white dark:bg-zinc-950",
        maxWidthClasses[maxWidth],
        className
      )}
      hideClose
      {...props}
    >
      <div className="relative flex flex-col">
        {children}

        {/* Decorative background element */}
        <div className={cn(
          "absolute -bottom-24 -left-24 h-48 w-48 rounded-full blur-[80px] opacity-10 pointer-events-none",
          variantStyles[variant].iconHalo
        )} />
      </div>
    </BaseDialogContent>
  )
})
AlertDialogContent.displayName = "AlertDialogContent"

const AlertDialogHeader = ({
  className,
  // allow callers to pass hideicon directly to the header when using the lower-level API
  hideicon = true,
  icon,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { hideicon?: boolean, icon?: React.ReactNode }) => {
  const { variant } = React.useContext(AlertDialogContext);
  const headerVariant = ({
    primary: "info",
    destructive: "destructive",
    warning: "warning",
  } as const)[variant] || "default";

  const headerIconKey = ({ primary: 'info', destructive: 'alert', warning: 'alert' } as const)[variant] ?? 'layout';

  return (
    <DialogHeader
      variant={headerVariant}
      hideicon={hideicon}
      icon={icon}
      iconkey={headerIconKey}
      className={cn("text-left p-8", className)}
      {...props}
    />
  );
};
AlertDialogHeader.displayName = "AlertDialogHeader"

const AlertDialogBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-8 space-y-6", className)} {...props} />
);
AlertDialogBody.displayName = "AlertDialogBody"

const AlertDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <DialogFooter
    variant="muted"
    className={cn("p-6", className)}
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
    className={cn("text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50 leading-[1.1] border-none", className)}
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
    className={cn("text-[15px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed pt-2", className)}
    {...props}
  />
))
AlertDialogDescription.displayName = DialogDescription.displayName

const AlertDialogAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { isLoading?: boolean }
>(({ className, isLoading, children, ...props }, ref) => {
  const { variant } = React.useContext(AlertDialogContext);
  return (
    <button
      ref={ref}
      className={cn(
        "h-12 flex-[1.4] rounded-2xl font-black py-1.5 transition-all shadow-[0_12px_24px_-8px] active:scale-[0.98] border-t border-white/20 dark:border-white/5 focus:outline-none focus-visible:outline-none",
        variantStyles[variant].button,
        className
      )}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          {children}
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2 tracking-tight">{children}</span>
      )
      }
    </button>
  );
})
AlertDialogAction.displayName = "AlertDialogAction"

const AlertDialogCancel = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  // Cancel should close the dialog immediately
  <DialogClose asChild>
    <button
      ref={ref}
      className={cn(
        "h-12 flex-1 rounded-2xl font-black py-1.5 border-none bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/80 transition-all active:scale-[0.98] focus:outline-none focus-visible:outline-none",
        className
      )}
      {...props}
    />
  </DialogClose>
))
AlertDialogCancel.displayName = "AlertDialogCancel"

const AlertDialogIcon = ({ 
  icon, 
  variant: propVariant,
  className 
}: { 
  icon?: LucideIcon;
  variant?: 'primary' | 'destructive' | 'warning';
  className?: string;
}) => {
  const context = React.useContext(AlertDialogContext);
  const variant = (propVariant || context.variant || 'primary') as 'primary' | 'destructive' | 'warning';
  
  // Choose default icon if not provided
  const Icon = icon || ({
    primary: Info,
    destructive: AlertTriangle,
    warning: AlertCircle
  }[variant] as LucideIcon);
  
  return (
    <div className={cn("flex justify-center sm:justify-start pb-2", className)}>
      <div className={cn(
        "relative h-16 w-16 rounded-[24px] flex items-center justify-center transition-transform hover:scale-105 duration-500",
        variantStyles[variant].iconBg
      )}>
        <Icon className={cn("h-8 w-8 relative z-10", variantStyles[variant].iconColor)} />
        <div className={cn("absolute inset-0 rounded-[24px] opacity-40 blur-lg", variantStyles[variant].iconBg)} />
      </div>
    </div>
  );
}

// Convenience high-level components
interface HighLevelAlertDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  variant?: 'primary' | 'destructive' | 'warning';
  icon?: LucideIcon;
  isLoading?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showConfirm?: boolean;
  showCancel?: boolean;
  dialogTag?: string;
  parentDialogTag?: string;
}

const CustomAlertDialog = ({
  isOpen,
  onOpenChange,
  title,
  description,
  confirmText = "Xác nhận",
  cancelText = "Hủy",
  onConfirm,
  onCancel,
  variant = 'primary',
  icon,
  isLoading = false,
  maxWidth = 'md',
  showConfirm = true,
  showCancel = true,
  dialogTag = 'alert-dialog',
  parentDialogTag = 'root'
}: HighLevelAlertDialogProps) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange} variant={variant} dialogTag={dialogTag} parentDialogTag={parentDialogTag}>
      <AlertDialogContent maxWidth={maxWidth}>
        <AlertDialogHeader className="sm:flex-row sm:space-y-0 sm:gap-5 items-center sm:items-start">
          {icon && (
            <div className="flex-shrink-0">
              <AlertDialogIcon icon={icon} />
            </div>
          )}
          <div className="flex-1 space-y-1.5 text-center sm:text-left sm:pt-1">
            <AlertDialogTitle className="text-2xl leading-tight">{title}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-[15px]">{description}</div>
            </AlertDialogDescription>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6">
          {showCancel && (
            <AlertDialogCancel onClick={onCancel} disabled={isLoading}>
              {cancelText}
            </AlertDialogCancel>
          )}
          {showConfirm && (
            <AlertDialogAction onClick={onConfirm} isLoading={isLoading}>
              {confirmText}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogBody,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogIcon,
  CustomAlertDialog
}
