"use client";
import * as React from "react";
import { Button as PrimerButton } from "@primer/react";

type PrimerButtonProps = React.ComponentProps<typeof PrimerButton> & {
  children?: React.ReactNode;
};

export const PrimerButtonAdapter = React.forwardRef<HTMLButtonElement, PrimerButtonProps>(
  ({ children, ...props }, ref) => {
    return (
      <PrimerButton ref={ref} {...props}>
        {children}
      </PrimerButton>
    );
  }
);
PrimerButtonAdapter.displayName = "PrimerButtonAdapter";

export default PrimerButtonAdapter;
