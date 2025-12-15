"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export const PrimerAlertDialogWrapper = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className={cn("primer-alert-dialog", className)} {...props}>
      {children}
    </div>
  );
};

export default PrimerAlertDialogWrapper;
