'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type DialogContextType = {
  isAnyDialogOpen: boolean;
  // Number of currently open dialogs (increments/decrements on open/close).
  openDialogCount: number;
  // Register a new dialog. Both tag and parentTag are required to describe nesting.
  registerDialog: (opts: { tag: string; parentTag: string }) => void;
  // Unregister a dialog by tag. If no tag provided, unregister the top-most dialog.
  unregisterDialog: (tag?: string) => void;
  // Subscribe to close events for the top-most dialog (or provide the dialog tag).
  subscribeToClose: (callback: () => void, tag?: string) => () => void;
  // Close a dialog. If tag provided, close the most recently opened dialog with that tag; otherwise close the top-most dialog.
  closeDialog: (opts?: { tag?: string }) => void;
};

export const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Maintain a stack of open dialogs with tags and a set of close callbacks for each dialog
  const openDialogs = React.useRef<
    Array<{
      tag: string;
      parentTag: string;
      callbacks: Set<() => void>;
    }>
  >([]);

  const [openDialogCountState, setOpenDialogCountState] = useState(0);

  const isAnyDialogOpen = openDialogCountState > 0;
  const openDialogCount = openDialogCountState;

  const registerDialog = useCallback((opts: { tag: string; parentTag: string }) => {
    // tag and parentTag are required
    openDialogs.current.push({ tag: opts.tag, parentTag: opts.parentTag, callbacks: new Set() });
    setOpenDialogCountState(openDialogs.current.length);
  }, []);

  const unregisterDialog = useCallback((tag?: string) => {
    if (tag == null) {
      // pop top-most
      openDialogs.current.pop();
      setOpenDialogCountState(openDialogs.current.length);
      return;
    }
    // remove the most recently opened dialog with this tag
    for (let i = openDialogs.current.length - 1; i >= 0; i--) {
      if (openDialogs.current[i].tag === tag) {
        openDialogs.current.splice(i, 1);
        break;
      }
    }
    setOpenDialogCountState(openDialogs.current.length);
  }, []);

  const subscribeToClose = useCallback((callback: () => void, tag?: string) => {
    // Associate the callback with the provided dialog tag or with the top-most dialog
    let target;
    if (tag != null) {
      for (let i = openDialogs.current.length - 1; i >= 0; i--) {
        if (openDialogs.current[i].tag === tag) {
          target = openDialogs.current[i];
          break;
        }
      }
    } else {
      target = openDialogs.current[openDialogs.current.length - 1];
    }

    if (!target) {
      // No dialog to subscribe to
      return () => {};
    }
    target.callbacks.add(callback);
    return () => {
      target.callbacks.delete(callback);
    };
  }, []);

  const closeDialog = useCallback((opts?: { tag?: string }) => {
    const { tag } = opts ?? {};

    // Decide which dialog is "on top" using the tag/parentTag relationships
    // rather than the registration order. We compute a nesting depth for
    // each open dialog by walking its parentTag chain and choosing the
    // dialog with the greatest depth (deepest child). If a tag is provided,
    // choose the deepest dialog matching that tag.
    const entries = openDialogs.current;
    if (entries.length === 0) {
      return;
    }

    const indexByTag = new Map<string, number>();
    for (let i = 0; i < entries.length; i++) {
      // map tag -> last index seen (unique tags encouraged, but keep last index)
      indexByTag.set(entries[i].tag, i);
    }

    const computeDepth = (startIdx: number) => {
      let depth = 0;
      let visited = new Set<string>();
      let parent = entries[startIdx].parentTag;
      while (parent && parent !== 'root' && !visited.has(parent)) {
        visited.add(parent);
        const parentIdx = indexByTag.get(parent);
        if (parentIdx === undefined) break; // parent not open
        depth++;
        parent = entries[parentIdx].parentTag;
      }
      return depth;
    };

    let candidates: number[] = [];

    // If any alert dialogs are open, prioritize closing the deepest alert dialog(s).
    const alertCandidates: number[] = [];
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].tag === 'alert-dialog') alertCandidates.push(i);
    }
    if (alertCandidates.length > 0) {
      candidates = alertCandidates;
    } else if (tag != null) {
      // all entries with this tag
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].tag === tag) candidates.push(i);
      }
    } else {
      // all entries are candidates
      for (let i = 0; i < entries.length; i++) candidates.push(i);
    }

    if (candidates.length === 0) {
      return;
    }

    // Choose the candidate with maximum nesting depth. Tie-break deterministically
    // by tag name (localeCompare) to avoid relying on registration order.
    let targetIndex = candidates[0];
    let bestDepth = computeDepth(targetIndex);
    for (let k = 1; k < candidates.length; k++) {
      const idx = candidates[k];
      const d = computeDepth(idx);
      if (d > bestDepth) {
        bestDepth = d;
        targetIndex = idx;
      } else if (d === bestDepth) {
        // deterministic tie-breaker: pick lexicographically larger tag
        const a = entries[idx].tag;
        const b = entries[targetIndex].tag;
        if (a.localeCompare(b) > 0) {
          targetIndex = idx;
        }
      }
    }

    const target = entries[targetIndex];
    // chosen target to close (no debug log)

    // Call callbacks in insertion order (they are probably a single callback per dialog)
    try {
      Array.from(target.callbacks).forEach((cb) => {
        try {
          cb();
        } catch (err) {
          // swallow errors to avoid crash during back handling
          // eslint-disable-next-line no-console
          console.error('Error while closing dialog callback:', err);
        }
      });
    } finally {
      // Remove the closed dialog from stack
      openDialogs.current.splice(targetIndex, 1);
      setOpenDialogCountState(openDialogs.current.length);
    }
  }, []);

  const value = { isAnyDialogOpen, openDialogCount, registerDialog, unregisterDialog, subscribeToClose, closeDialog };

  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
};

export const useDialogContext = () => {
  const context = useContext(DialogContext);
  if (context === undefined) {
    throw new Error('useDialogContext must be used within a DialogProvider');
  }
  return context;
};

export const useDialogBackHandler = (
  open: boolean,
  onOpenChange: (open: boolean) => void,
  opts: { tag: string; parentTag: string }
) => {
  const context = useContext(DialogContext);

  useEffect(() => {
    if (open) {
      context?.registerDialog(opts);
      const unsubscribe = context?.subscribeToClose(() => onOpenChange(false), opts.tag);
      return () => {
        unsubscribe?.();
        context?.unregisterDialog(opts.tag);
      };
    }
    // if dialog is not open, nothing to cleanup
    // We purposely depend on opts.tag and opts.parentTag so new tags cause re-registration if needed
  }, [open, onOpenChange, context, opts.tag, opts.parentTag]);
};