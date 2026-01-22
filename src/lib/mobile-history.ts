export type MobileHistoryEntry = { kind: 'page' | 'tab'; value: string };

const HOME_HISTORY_ENTRY: MobileHistoryEntry = { kind: 'tab', value: 'home' };

let historySeeded = false;
const mobileHistoryStack: MobileHistoryEntry[] = [];

function cloneEntry(entry: MobileHistoryEntry): MobileHistoryEntry {
  return { kind: entry.kind, value: entry.value };
}

function parseMobileHashTarget(href: string): { kind: 'page'; value: string } | { kind: 'tab'; value: string } | null {
  const idx = href.indexOf('#');
  const hash = idx >= 0 ? href.slice(idx) : href;

  if (hash.startsWith('#page=')) {
    const raw = hash.slice('#page='.length);
    return { kind: 'page', value: raw };
  }
  if (hash.startsWith('#tab=')) {
    const raw = hash.slice('#tab='.length);
    return { kind: 'tab', value: raw };
  }
  return null;
}

function decodeHashValue(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function setHash(hash: string, mode: 'push' | 'replace') {
  if (typeof window === 'undefined') return;
  if (!hash.startsWith('#')) return;
  if (window.location.hash === hash) return;

  const nextUrl = `${window.location.pathname}${window.location.search}${hash}`;
  if (mode === 'replace') window.history.replaceState(null, '', nextUrl);
  else window.history.pushState(null, '', nextUrl);

  try {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } catch {
    window.dispatchEvent(new Event('hashchange'));
  }
}

function resetMobileHistory() {
  mobileHistoryStack.length = 0;
  historySeeded = false;
}

function readCurrentLocationEntry(): MobileHistoryEntry | null {
  if (typeof window === 'undefined') return null;

  const { pathname, search, hash } = window.location;
  const parsed = parseMobileHashTarget(hash);
  if (parsed) {
    return { kind: parsed.kind, value: decodeHashValue(parsed.value) };
  }

  const value = `${pathname}${search}` || '/';
  return { kind: 'page', value };
}

function ensureHistorySeeded() {
  if (historySeeded) return;
  const entry = readCurrentLocationEntry();
  if (!entry) return;
  mobileHistoryStack.push(entry);
  historySeeded = true;
}

function syncHistoryWithLocation() {
  if (!historySeeded) return;
  const entry = readCurrentLocationEntry();
  if (!entry) return;

  if (mobileHistoryStack.length === 0) {
    mobileHistoryStack.push(entry);
    historySeeded = true;
    return;
  }

  const top = mobileHistoryStack[mobileHistoryStack.length - 1];
  if (top.kind !== entry.kind || top.value !== entry.value) {
    mobileHistoryStack[mobileHistoryStack.length - 1] = entry;
  }
}

function prepareHistoryMutation() {
  ensureHistorySeeded();
  syncHistoryWithLocation();
}

function initMobileHistory() {
  resetMobileHistory();
  ensureHistorySeeded();
  syncHistoryWithLocation();
  try {
    // Debug: log initial stack state
  } catch {}
}

function createHistoryEntry(href: string): MobileHistoryEntry {
  const parsed = parseMobileHashTarget(href);
  if (parsed) {
    return { kind: parsed.kind, value: decodeHashValue(parsed.value) };
  }
  return { kind: 'page', value: href };
}

function recordPushEntry(entry: MobileHistoryEntry) {
  prepareHistoryMutation();
  // Debug: log before/after push
  mobileHistoryStack.push(cloneEntry(entry));
}

function recordReplaceEntry(entry: MobileHistoryEntry) {
  prepareHistoryMutation();
  if (mobileHistoryStack.length === 0) {
    mobileHistoryStack.push(cloneEntry(entry));
    historySeeded = true;
    return;
  }
  mobileHistoryStack[mobileHistoryStack.length - 1] = cloneEntry(entry);
}

function recordBackEntry(steps: number): MobileHistoryEntry {
  prepareHistoryMutation();
  if (mobileHistoryStack.length <= 1) {
    resetMobileHistory();
    const fallback = cloneEntry(HOME_HISTORY_ENTRY);
    mobileHistoryStack.push(fallback);
    historySeeded = true;
    return fallback;
  }

  const targetIndex = Math.max(0, mobileHistoryStack.length - 1 - steps);
  const target = mobileHistoryStack[targetIndex];
  mobileHistoryStack.splice(targetIndex + 1);

  return target;
}

function applyHistoryEntry(
  entry: MobileHistoryEntry,
  mode: 'push' | 'replace',
  mobileNav?: { push: (href: string) => void; replace: (href: string) => void } | null,
) {
  if (entry.kind === 'tab') {
    setHash(`#tab=${encodeURIComponent(entry.value)}`, mode);
    return;
  }

  if (mobileNav) {
    if (mode === 'replace') mobileNav.replace(entry.value);
    else mobileNav.push(entry.value);
    return;
  }

  setHash(`#page=${encodeURIComponent(entry.value)}`, mode);
}

function normalizeBackDelta(delta?: number): number {
  if (typeof delta !== 'number' || !Number.isFinite(delta)) return 1;
  const value = Math.floor(Math.abs(delta));
  return value > 0 ? value : 1;
}

export {
  resetMobileHistory,
  createHistoryEntry,
  recordPushEntry,
  recordReplaceEntry,
  recordBackEntry,
  applyHistoryEntry,
  normalizeBackDelta,
  initMobileHistory,
};

