import { Capacitor } from "@capacitor/core";
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile(ref?: React.RefObject<HTMLElement>) {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    if (Capacitor.isNativePlatform()) {
        setIsMobile(true);
        return;
    }

    const targetElement = ref?.current;
    
    // If a ref is provided, use ResizeObserver
    if (targetElement) {
        const observer = new ResizeObserver(entries => {
            if (entries[0]) {
                const { width } = entries[0].contentRect;
                setIsMobile(width < MOBILE_BREAKPOINT);
            }
        });

        observer.observe(targetElement);

        // Initial check
        setIsMobile(targetElement.offsetWidth < MOBILE_BREAKPOINT);

        return () => observer.unobserve(targetElement);
    } 
    // Fallback to window resize if no ref is provided
    else {
        const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
        const onChange = () => {
            setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
        }
        mql.addEventListener("change", onChange)
        
        // Initial check
        setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
        
        return () => mql.removeEventListener("change", onChange)
    }
  }, [ref])

  return !!isMobile
}
