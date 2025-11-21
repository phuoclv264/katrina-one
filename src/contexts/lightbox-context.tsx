'use client';

import React, { createContext, useState, useContext, useCallback, useEffect, useRef } from 'react';
import Lightbox, { type Slide } from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Counter from 'yet-another-react-lightbox/plugins/counter';
import Captions from 'yet-another-react-lightbox/plugins/captions';
import Video from "yet-another-react-lightbox/plugins/video";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";
import "yet-another-react-lightbox/plugins/captions.css";

interface LightboxContextType {
  openLightbox: (slides: Slide[], index?: number) => void;
  closeLightbox: () => void;
  isLightboxOpen: boolean;
}

const LightboxContext = createContext<LightboxContextType | undefined>(undefined);

export const useLightbox = () => {
  const context = useContext(LightboxContext);
  if (!context) {
    throw new Error('useLightbox must be used within a LightboxProvider');
  }
  return context;
};

export const LightboxProvider = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [index, setIndex] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // This effect runs only on the client, after the component has mounted.
    setIsMounted(true);
  }, []);

  const openLightbox = useCallback((slides: Slide[], index = 0) => {
    setSlides(slides);
    setIndex(index);
    setOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setOpen(false);
  }, []);

  // Handle hardware back button to close lightbox
  // useEffect(() => {
  //   const handleCloseEvent = () => closeLightbox();
  //   document.addEventListener('close-lightbox', handleCloseEvent);
  //   return () => document.removeEventListener('close-lightbox', handleCloseEvent);
  // }, [closeLightbox]);

  // Handle hardware/browser back button to close the lightbox.
  // When the lightbox opens, we push a state to the history.
  // When the user navigates back (via button or gesture), the `popstate` event is fired.
  // We catch this event and close the lightbox instead of allowing the page to navigate back.
  useEffect(() => {
    if (open) {
      window.history.pushState({ lightbox: 'open' }, '');
    }

    const handlePopState = (event: PopStateEvent) => {
      if (open) {
        closeLightbox();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [open, closeLightbox]);

  return (
    <LightboxContext.Provider value={{ openLightbox, closeLightbox, isLightboxOpen: open }}>
      {isMounted && (
        <Lightbox
          open={open}
          close={closeLightbox}
          slides={slides}
          index={index}
          plugins={[Zoom, Counter, Captions, Video]}
          carousel={{ finite: true }}
          zoom={{ maxZoomPixelRatio: 4 }}
          counter={{ container: { style: { top: "unset", bottom: 0 } } }}
          captions={{ showToggle: true, descriptionTextAlign: 'center', descriptionMaxLines: 5 }}
          styles={{
            root: {
              pointerEvents: 'auto', // ensure interaction is possible
            }
          }}
        />
      )}
      {children}
    </LightboxContext.Provider>
  );
};