'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type DialogContextType = {
  isAnyDialogOpen: boolean;
  registerDialog: () => void;
  unregisterDialog: () => void;
  subscribeToClose: (callback: () => void) => () => void;
  closeDialog: () => void; // New function to directly close all dialogs
};

export const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [openDialogCount, setOpenDialogCount] = useState(0);
  const closeSubscribers = React.useRef(new Set<() => void>());

  const isAnyDialogOpen = openDialogCount > 0;

  const registerDialog = useCallback(() => {
    setOpenDialogCount(prev => prev + 1);
  }, []);

  const unregisterDialog = useCallback(() => {
    setOpenDialogCount(prev => Math.max(0, prev - 1));
  }, []);

  const subscribeToClose = useCallback((callback: () => void) => {
    closeSubscribers.current.add(callback);
    return () => {
      closeSubscribers.current.delete(callback);
    };
  }, []);

  const closeDialog = useCallback(() => {
    const closeSubscribersArray = Array.from(closeSubscribers.current);
    if (closeSubscribersArray.length === 0) return;
    closeSubscribersArray[0].call((cb: () => any) => cb());
  }, []);

  const value = { isAnyDialogOpen, registerDialog, unregisterDialog, subscribeToClose, closeDialog };

  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
};

export const useDialogContext = () => {
  const context = useContext(DialogContext);
  if (context === undefined) {
    throw new Error('useDialogContext must be used within a DialogProvider');
  }
  return context;
};

export const useDialogBackHandler = (open: boolean, onOpenChange: (open: boolean) => void) => {
  const context = useContext(DialogContext);

  useEffect(() => {
    if (open) {
      context?.registerDialog();
      const unsubscribe = context?.subscribeToClose(() => onOpenChange(false));
      return () => {
        context?.unregisterDialog();
        unsubscribe?.();
      };
    }
  }, [open, onOpenChange, context]);
};