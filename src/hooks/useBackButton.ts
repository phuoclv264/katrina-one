"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Capacitor, PluginListenerHandle } from "@capacitor/core";
import { App } from "@capacitor/app";
import toast from "react-hot-toast";

interface LightboxControls {
  isLightboxOpen: boolean;
  closeLightbox: () => void;
}

interface DialogControls {
  isAnyDialogOpen: boolean;
  closeDialog: () => void;
}

export function useBackButton(
  dialog?: DialogControls,
  lightbox?: LightboxControls,
  userRole?: string
) {
  const router = useRouter();
  const pathname = usePathname();
  const savedHandler = useRef<() => void>();

  // Use refs to hold the latest values of dependencies
  const lightboxRef = useRef(lightbox);
  const dialogRef = useRef(dialog);
  useEffect(() => {
    lightboxRef.current = lightbox;
    dialogRef.current = dialog;
  }, [lightbox, dialog]);

  const backButtonHandler = useCallback(
    ({ canGoBack }: { canGoBack: boolean }) => {
      const currentLightbox = lightboxRef.current;
      const currentDialog = dialogRef.current;
      toast.success("Tap back, " + (currentLightbox?.isLightboxOpen ? "lightbox is opened, " : "") + (currentDialog?.isAnyDialogOpen ? "Dialog is opened" : ""));
      
      if (currentLightbox?.isLightboxOpen) {
        currentLightbox.closeLightbox();
      } else if (currentDialog?.isAnyDialogOpen) {
        currentDialog.closeDialog();
      } else if (canGoBack && pathname !== "/shifts" && pathname !== "/bartender" && pathname !== "/manager" && pathname !== "/admin") {
        if (userRole === "Phục vụ") {
          router.push("/shifts");
        } else if (userRole === "Pha chế") {
          router.push("/bartender");
        } else if (userRole === "Quản lý") {
          router.push("/manager");
        } else if (userRole === "Chủ nhà hàng") {
          router.push("/admin");
        }
      } else {
        App.minimizeApp();
      }
    },
    [router, userRole]
  );

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let handler: PluginListenerHandle;
    App.addListener("backButton", backButtonHandler).then(
      (h) => (handler = h)
    );

    return () => {
      handler?.remove();
    };
  }, [backButtonHandler]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // --- OPEN LIGHTBOX ---
    if (lightbox?.isLightboxOpen && !history.state?.lightbox) {
      window.history.pushState({ lightbox: true }, "", window.location.href);
    }
  }, [lightbox?.isLightboxOpen]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // --- OPEN DIALOG ---
    if (dialog?.isAnyDialogOpen && !history.state?.dialog) {
      window.history.pushState({ dialog: true }, "", window.location.href);
    }

    // --- BACK BUTTON HANDLER ---
    const handlePopState = () => {
      // CLOSE LIGHTBOX FIRST
      if (lightbox?.isLightboxOpen) {
        lightbox.closeLightbox();
        return; // prevent navigation
      }

      // CLOSE DIALOG
      if (dialog?.isAnyDialogOpen) {
        dialog.closeDialog();
        return; // prevent navigation
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [dialog?.isAnyDialogOpen]);
}
