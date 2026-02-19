'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { triggerManualRefresh } from '@/hooks/data-refresher-manager';
import { toast } from '@/components/ui/pro-toast';

const MAX_PULL = 140; // px
const REFRESH_THRESHOLD = 80; // px
const HIDE_OFFSET = -56; // px initial hidden position

function findScrollParent(el: Element | null): Element | Window {
  let node: Element | null = el as Element | null;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node as Element);
    const overflowY = style.overflowY || style.overflow;
    if (/(auto|scroll)/.test(overflowY) && (node as HTMLElement).scrollHeight > (node as HTMLElement).clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return window;
}

function getScrollTop(container: Element | Window): number {
  if (container === window) return window.scrollY || document.documentElement.scrollTop || 0;
  return (container as HTMLElement).scrollTop;
}

export default function PullToRefresh() {
  const startY = useRef<number | null>(null);
  const containerRef = useRef<Element | Window | null>(null);
  const draggingRef = useRef(false);
  const [pull, setPull] = useState(0);
  const [status, setStatus] = useState<'idle' | 'pulling' | 'ready' | 'refreshing'>('idle');

  useEffect(() => {
    if (typeof window === 'undefined' || !('ontouchstart' in window)) return;

    const onTouchStart = (ev: TouchEvent) => {
      if (ev.touches.length !== 1) return;
      const touch = ev.touches[0];

      const scrollParent = findScrollParent(ev.target as Element | null);
      containerRef.current = scrollParent;

      // only start when the scroll parent is scrolled to top
      if (getScrollTop(scrollParent) > 0) {
        startY.current = null;
        return;
      }

      startY.current = touch.clientY;
      draggingRef.current = true;
      setStatus('pulling');
    };

    const onTouchMove = (ev: TouchEvent) => {
      if (!draggingRef.current || startY.current === null || status === 'refreshing') return;
      if (ev.touches.length !== 1) return;
      const touch = ev.touches[0];
      const deltaY = touch.clientY - startY.current;
      if (deltaY <= 0) {
        setPull(0);
        setStatus('pulling');
        return;
      }

      // if the underlying scroll container scrolled (e.g., inner content moved), abort
      const scrollParent = containerRef.current ?? window;
      if (getScrollTop(scrollParent) > 0) {
        setPull(0);
        setStatus('idle');
        return;
      }

      // prevent native overscroll bounce so user sees our indicator
      if (ev.cancelable) ev.preventDefault();

      // dampen the pull for nicer UX
      const pulled = Math.min(MAX_PULL, Math.round(deltaY * 0.6));
      setPull(pulled);
      setStatus(pulled >= REFRESH_THRESHOLD ? 'ready' : 'pulling');
    };

    const finish = async () => {
      draggingRef.current = false;
      startY.current = null;

      if (status === 'ready' && pull >= REFRESH_THRESHOLD) {
        setStatus('refreshing');
        // keep the indicator visible at a small fixed position while refreshing
        setPull(48);
        // trigger an in‑app (soft) refresh and wait for subscribers to finish
        try {
          const refreshed = await triggerManualRefresh('pull-to-refresh');
          if (refreshed) {
            toast.success('Đã tải lại trang');
          } else {
            toast.info('Không có dữ liệu mới');
          }
        } catch (err) {
          console.error('PullToRefresh: triggerManualRefresh failed', err);
          toast.error('Cập nhật thất bại');
        }

        // hide the UI after a short moment so user sees the completion toast
        setTimeout(() => {
          setStatus('idle');
          setPull(0);
        }, 700);
        return;
      }

      // animate back
      setStatus('idle');
      setPull(0);
    };

    const onTouchEnd = () => void finish();
    const onTouchCancel = () => void finish();

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [status, pull]);

  // Do not render on desktop / non-touch devices
  if (typeof window === 'undefined' || !('ontouchstart' in window)) return null;

  const transformY = pull > 0 ? pull : HIDE_OFFSET;
  const opacity = pull > 0 ? Math.min(1, pull / 48) : 0;

  return (
    <div
      aria-hidden={status === 'idle'}
      role="status"
      className="pointer-events-none fixed left-0 right-0 top-0 z-[9999] flex justify-center"
      style={{ transform: `translateY(${transformY}px)`, transition: draggingRef.current ? 'none' : 'transform 220ms ease' }}
    >
      <div
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-background/95 shadow-md border ring-1 ring-black/5"
        style={{ opacity, transform: `scale(${0.95 + Math.min(0.05, pull / 100)})`, transition: draggingRef.current ? 'none' : 'all 180ms ease' }}
      >
        {status === 'refreshing' ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-muted-foreground"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a7 7 0 11-1.45-9.7L23 10" /></svg>
        )}
        <div className="text-xs text-muted-foreground">
          {status === 'refreshing' ? 'Đang tải lại…' : status === 'ready' ? 'Thả để tải lại' : 'Kéo để tải lại'}
        </div>
      </div>
    </div>
  );
}
