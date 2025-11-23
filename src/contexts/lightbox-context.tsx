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