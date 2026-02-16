'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useAppNavigation } from '@/contexts/app-navigation-context';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  LogOut, CalendarDays, ChevronRight, Sparkles, UserCircle,
  CheckSquare, Coffee, Banknote, UserCog, BarChart3
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { ProfileDialog } from './profile-dialog';
import { useCheckInCardPlacement } from '@/hooks/useCheckInCardPlacement';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { getUserAccessLinks } from '@/lib/user-access-links';
import { toast } from '@/components/ui/pro-toast';
import { parseManifestPayload, ManifestPayload } from '@/lib/capacitor-updater-status';

// show app / updater status
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import packageJson from '../../package.json';

interface UserMenuViewProps {
  onNavigateToHome?: () => void;
  onNavigate?: (href: string) => void;
}

export default function UserMenuView({ onNavigateToHome, onNavigate }: UserMenuViewProps) {
  const { user, logout, loading, isOnActiveShift, activeShifts } = useAuth();
  const { isCheckedIn } = useCheckInCardPlacement();
  const nav = useAppNavigation();
  const [profileOpen, setProfileOpen] = useState(false);

  const [installedVersion, setInstalledVersion] = useState<string | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const manifestUrl = process.env.NEXT_PUBLIC_UPDATER_MANIFEST_URL || '';
  const MANIFEST_FETCH_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_UPDATER_MANIFEST_TIMEOUT_MS ?? 15000);
  const [checkingManifest, setCheckingManifest] = useState(false);
  const [manifestCheckMessage, setManifestCheckMessage] = useState<string | null>(null);
  const [isAutoUpdateDisabled, setIsAutoUpdateDisabled] = useState(false);
  const [pendingUpdateVersion, setPendingUpdateVersion] = useState<string | null>(null);

  const refreshAutoUpdateStatus = useCallback(async () => {
    // use plugin API to reflect whether auto-update is enabled in plugin config
    if (!Capacitor.isNativePlatform()) {
      setIsAutoUpdateDisabled(false);
      return;
    }

    try {
      const res = await CapacitorUpdater.isAutoUpdateEnabled();
      setIsAutoUpdateDisabled(!res.enabled);
    } catch {
      setIsAutoUpdateDisabled(false);
    }
  }, []);

  const refreshPendingUpdateVersion = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      setPendingUpdateVersion(null);
      return;
    }

    try {
      const next = await CapacitorUpdater.getNextBundle();
      setPendingUpdateVersion(next?.version ?? null);
    } catch {
      setPendingUpdateVersion(null);
    }
  }, []);

  const formatDateTime = (value: number | null) => (value ? new Date(value).toLocaleString() : '—');

  const fetchManifestInfo = useCallback(async (): Promise<ManifestPayload | null> => {
    if (!manifestUrl || typeof window === 'undefined') return null;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), MANIFEST_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(manifestUrl, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Manifest request failed: ${response.status}`);
      }
      const data = await response.json();
      return parseManifestPayload(data);
    } finally {
      clearTimeout(timeoutId);
    }
  }, [manifestUrl, MANIFEST_FETCH_TIMEOUT_MS]);

  const handleManifestResult = useCallback((manifest: ManifestPayload | null, message: string) => {
    setLatestVersion(manifest?.version ?? null);
    setManifestCheckMessage(message);
    setLastChecked(new Date().toLocaleString());
  }, []);

  const handleManualManifestCheck = async () => {
    if (!manifestUrl || checkingManifest) return;
    setCheckingManifest(true);
    try {
      const manifest = await fetchManifestInfo();
      if (manifest) {
        handleManifestResult(manifest, `Manifest truy cập được — v${manifest.version}`);
      } else {
        handleManifestResult(null, 'Manifest không hợp lệ hoặc không đầy đủ dữ liệu.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể kiểm tra manifest.';
      handleManifestResult(null, `Không thể kiểm tra manifest (${message}).`);
    } finally {
      setCheckingManifest(false);
      // call plugin-backed refreshers
      void refreshAutoUpdateStatus();
      void refreshPendingUpdateVersion();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('cap-updater-check'));
      }
    }
  };

  // removed manual re-enable — plugin manages failures/rollbacks now.

  useEffect(() => {
    let mounted = true;

    async function readVersions() {
      if (Capacitor.isNativePlatform()) {
        try {
          const current = await CapacitorUpdater.current();
          if (!mounted) return;
          setInstalledVersion(current.bundle?.version ?? 'builtin');
        } catch (err) {
          if (!mounted) return;
          setInstalledVersion('unknown');
        }
      } else {
        setInstalledVersion(packageJson.version ?? null);
      }

      if (!manifestUrl) return;

      try {
        const manifest = await fetchManifestInfo();
        if (!mounted) return;
        if (manifest) {
          handleManifestResult(manifest, `Manifest truy cập được — v${manifest.version}`);
        } else {
          handleManifestResult(null, 'Manifest không hợp lệ hoặc không đầy đủ dữ liệu.');
        }
      } catch (err: unknown) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : 'Không thể kiểm tra manifest.';
        handleManifestResult(null, `Không thể kiểm tra manifest (${message}).`);
      }
    }

    readVersions();
    void refreshAutoUpdateStatus();
    void refreshPendingUpdateVersion();

    return () => { mounted = false; };
  }, [fetchManifestInfo, refreshAutoUpdateStatus, refreshPendingUpdateVersion, handleManifestResult, manifestUrl]);

  if (!user) return null;

  // Get all menu items from centralized access utility
  const access = getUserAccessLinks({ user, isCheckedIn, activeShifts: activeShifts || [], isOnActiveShift });
  
  // Convert AccessLink to the format expected by the UI — exclude grouped links so
  // they are rendered exclusively inside the accordion sections below.
  const primaryItems = access.primary
    .filter(l => !l.group)
    .map(link => ({ href: link.href, label: link.label, icon: link.icon }));

  const secondaryItems = access.secondary
    .filter(l => !l.group)
    .map(link => ({ role: link.roleTag || link.subLabel || '', item: { href: link.href, label: link.label, icon: link.icon } }));

  // Ensure a per-role "Home" (dashboard/overview) shortcut is available in the USER MENU only.
  // This keeps the sidebar behavior unchanged and preserves original labels/icons.
  const roleHomeMap: Record<string, { href: string; label: string; icon: any }> = {
    'Phục vụ': { href: '/shifts', label: 'Bảng điều khiển', icon: CheckSquare },
    'Pha chế': { href: '/bartender', label: 'Bảng điều khiển', icon: Coffee },
    'Thu ngân': { href: '/cashier', label: 'Bảng điều khiển', icon: Banknote },
    'Quản lý': { href: '/manager', label: 'Bảng điều khiển', icon: UserCog },
    'Chủ nhà hàng': { href: '/admin', label: 'Tổng quan', icon: BarChart3 },
  };

  const roleHome = roleHomeMap[user.role || ''];
  if (roleHome && !primaryItems.some((i) => i.href === roleHome.href)) {
    // always show home shortcut in the user menu (independent of check-in)
    primaryItems.unshift(roleHome);
  }

  // Build grouped links (items with group property) - exclude items already in primary/secondary
  const existingHrefs = new Set([
    ...primaryItems.map(i => i.href),
    ...secondaryItems.map(s => s.item.href),
  ]);
  const grouped = [...access.primary, ...access.secondary].reduce((acc, l) => {
    if (!l.group) return acc;
    if (existingHrefs.has(l.href)) return acc; // don't duplicate
    (acc[l.group] ||= []).push(l);
    return acc;
  }, {} as Record<string, typeof access.primary>);

  const handleNavigate = (href: string) => {
    // Check if this is a "Home" link (Dashboard/Overview)
    const isHomeLink = ['/shifts', '/bartender', '/manager', '/admin'].includes(href);

    if (isHomeLink && onNavigateToHome) {
      onNavigateToHome();
    } else {
      nav.push(href);
    }
  }

  return (
    <div className="flex flex-col h-full bg-background/50">
      {/* Header Profile Section */}
      <div className="p-6 pb-2">
        <div className="flex items-start justify-between mb-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold tracking-tight">Xin chào,</h2>
            <h3 className="text-xl font-semibold text-primary">{user.displayName}</h3>
          </div>
          <UserAvatar user={user} size="h-16 w-16" rounded="full" className="border-2 border-background shadow-lg" />
        </div>

        <div className="flex items-center justify-between gap-2 mb-2">
          <Badge variant="secondary" className="px-3 py-1 text-sm font-medium capitalize shadow-sm">
            {user.role}
          </Badge>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setProfileOpen(true)}
              className="text-muted-foreground hover:text-primary hover:bg-primary/10"
            >
              <UserCircle className="w-4 h-4 mr-2" />
              Hồ sơ
            </Button>
          </div>
        </div>
      </div>

      <Separator className="mb-4" />

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} parentDialogTag="root" />

      {/* Menu Items */}
      <div className="flex-1 px-4 pb-6">
        <div className="space-y-3">
          {primaryItems.map((item, index) => (
            <button
              key={item.href}
              onClick={() => handleNavigate(item.href)}
              className="group relative flex items-center w-full p-3 overflow-hidden transition-all bg-card border rounded-xl shadow-sm hover:shadow-md hover:border-primary/50 active:scale-[0.98]"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <item.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 ml-4 text-left">
                <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                  {item.label}
                </span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
            </button>
          ))}

          {/* Grouped links from centralized access utility (render inside accordions) */}
          {Object.entries(grouped).map(([groupLabel, links]) => (
            <div key={groupLabel} className="pt-4">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value={groupLabel}>
                  <AccordionTrigger className="px-1 py-2 text-sm font-semibold flex items-center justify-between">{groupLabel}</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 mt-2">
                      {links.map((l) => (
                        <button
                          key={l.href}
                          onClick={() => handleNavigate(l.href)}
                          className="group flex items-center w-full p-3 transition-all bg-muted/10 border rounded-lg hover:bg-card"
                        >
                          <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-muted text-muted-foreground mr-3"><l.icon className="w-4 h-4" /></div>
                          <div className="flex-1 text-left"><span className="font-medium">{l.label}</span></div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                        </button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          ))}

          {secondaryItems.length > 0 && (
            <div className="pt-4 mt-2">
              <div className="flex items-center gap-2 mb-4 px-1">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Tiện ích
                </span>
              </div>

              <div className="space-y-3">
                {secondaryItems.map(({ role, item }, idx) => (
                  <div key={`${role}-${idx}`} className="relative">
                    <div className="absolute -top-2 left-4 px-2 bg-background text-[10px] font-bold text-muted-foreground uppercase z-10">
                      {role}
                    </div>
                    <button
                      onClick={() => handleNavigate(item.href)}
                      className="group flex items-center w-full p-3 mt-1 transition-all bg-muted/30 border border-dashed rounded-xl hover:bg-card hover:border-solid hover:border-amber-500/50 hover:shadow-sm active:scale-[0.98]"
                    >
                      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted text-muted-foreground group-hover:bg-amber-100 group-hover:text-amber-600 transition-colors">
                        <item.icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 ml-4 text-left">
                        <span className="text-sm font-medium text-foreground/80 group-hover:text-amber-700 transition-colors">
                          {item.label}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-amber-500 transition-colors" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="h-6" /> {/* Bottom spacer */}

        {/* Make the logout part of the scrollable content so it can be scrolled
            above the BottomNav when the bottom nav is visible. */}
        <div className="mt-4 mb-4 p-4 border-t bg-background/50">
          <Button
            variant="destructive"
            size="sm"
            onClick={logout}
            disabled={loading}
            className="w-full justify-center"
            aria-label="Đăng xuất"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Đăng xuất
          </Button>

          {/* Version / updater info */}
          <div className="mt-3 text-xs text-muted-foreground space-y-1">
            <div>Phiên bản app: <span className="font-medium">v{packageJson.version}</span></div>
            <div>Phiên bản hiện tại: <span className="font-medium">{installedVersion ?? '—'}</span></div>
            <div>Bản cập nhật mới nhất: <span className="font-medium">{latestVersion ?? '—'}</span></div>
            <div>Kiểm tra lần cuối: <span className="font-medium">{lastChecked ?? '—'}</span></div>

            <div className="pt-2 border-t border-dashed border-muted/40">
              <div className="flex items-center justify-between text-[11px] text-foreground">
                <span className="font-semibold">Tự động cập nhật</span>
                <span className={isAutoUpdateDisabled ? 'text-amber-500' : 'text-emerald-500'}>
                  {isAutoUpdateDisabled ? 'Tạm dừng' : 'Đang hoạt động'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleManualManifestCheck}
                  disabled={!manifestUrl || checkingManifest}
                >
                  {checkingManifest ? 'Đang kiểm tra...' : 'Kiểm tra bản cập nhật'}
                </Button>
              </div>
              {manifestCheckMessage && (
                <div className="text-[10px] text-muted-foreground/80 mt-1">
                  {manifestCheckMessage}
                </div>
              )}
              {pendingUpdateVersion && installedVersion && pendingUpdateVersion !== installedVersion && (
                <div className="text-[10px] text-emerald-500 mt-1">
                  Bản cập nhật v{pendingUpdateVersion} đã tải xong — khởi động lại để áp dụng.
                </div>
              )}
            </div>

            {latestVersion && installedVersion && latestVersion !== installedVersion && (
              <div className="text-amber-600">Bản cập nhật khả dụng</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
