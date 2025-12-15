"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export const PrimerCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn("primer-card rounded-lg border bg-card text-card-foreground shadow-sm", className)} {...props}>
    {children}
  </div>
));
PrimerCard.displayName = "PrimerCard";

export const PrimerCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn("primer-card__header flex flex-col space-y-1.5 p-4", className)} {...props}>
    {children}
  </div>
));
PrimerCardHeader.displayName = "PrimerCardHeader";

export default PrimerCard;
