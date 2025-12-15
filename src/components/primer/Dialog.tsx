"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export function PrimerDialogWrapper({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("primer-dialog", className)} {...props}>
      {children}
    </div>
  );
}

export default PrimerDialogWrapper;
