"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export const PrimerToastContainer = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("primer-toast-container", className)} {...props}>
    {children}
  </div>
);

export const PrimerToast = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("primer-toast rounded-2xl", className)} {...props}>
    {children}
  </div>
);

export default PrimerToast;
