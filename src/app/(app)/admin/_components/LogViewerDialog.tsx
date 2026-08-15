'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogAction,
  DialogCancel,
} from '@/components/ui/dialog';
import { ClipboardCopy, History, RefreshCcw, Trash2 } from 'lucide-react';
import { toast } from '@/components/ui/pro-toast';
import { AppLogEntry, deleteAllAppLogsFromServer, deleteAppLogFromServer, fetchAppLogsFromServer } from '@/lib/log-store';

interface LogViewerDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  parentDialogTag: string;
}

const formatTimestamp = (timestamp: string) => {
  return new Date(timestamp).toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const formatLogDetails = (entry: AppLogEntry) => {
  return entry.details ? `${entry.message}\n${entry.details}` : entry.message;
};

export default function LogViewerDialog({ isOpen, onOpenChange, parentDialogTag }: LogViewerDialogProps) {
  const [serverLogs, setServerLogs] = useState<AppLogEntry[]>([]);
  const [loadingServerLogs, setLoadingServerLogs] = useState(false);
  const [errorLoadingServerLogs, setErrorLoadingServerLogs] = useState<string | null>(null);

  const loadServerLogs = async () => {
    setLoadingServerLogs(true);
    setErrorLoadingServerLogs(null);
    try {
      const fetched = await fetchAppLogsFromServer(100);
      setServerLogs(fetched);
    } catch (error) {
      setErrorLoadingServerLogs('Không thể tải log từ máy chủ.');
      console.error('Failed to load logs from server:', error);
    } finally {
      setLoadingServerLogs(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadServerLogs();
    }
  }, [isOpen]);

  const displayedLogs = useMemo(() => {
    return [...serverLogs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [serverLogs]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayedLogs.map((entry) => `[${entry.level.toUpperCase()}] ${formatTimestamp(entry.timestamp)} - ${formatLogDetails(entry)}`).join('\n\n'));
      toast.success('Đã sao chép log từ server vào clipboard');
    } catch (error) {
      console.error('Failed to copy logs to clipboard:', error);
      toast.error('Không thể sao chép log');
    }
  };

  const handleDeleteLog = async (logId: string) => {
    const success = await deleteAppLogFromServer(logId);
    if (success) {
      setServerLogs((prev) => prev.filter((entry) => entry.id !== logId));
      toast.success('Đã xóa log thành công');
    } else {
      toast.error('Xóa log thất bại');
    }
  };

  const handleDeleteAllLogs = async () => {
    const success = await deleteAllAppLogsFromServer();
    if (success) {
      setServerLogs([]);
      toast.success('Đã xóa tất cả log');
    } else {
      toast.error('Xóa tất cả log thất bại');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange} dialogTag="log-viewer-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogHeader variant="info" iconkey="history" className="pb-4">
          <div className="flex flex-col gap-1">
            <DialogTitle className="text-2xl font-bold tracking-tight">Log ứng dụng</DialogTitle>
            <DialogDescription className="text-base text-slate-500">
              Xem các thông tin ghi log gần đây được thu thập trong ứng dụng.
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogBody className="px-6 py-4 flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-500">
              Tổng số: {displayedLogs.length} • Máy chủ: {serverLogs.length}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadServerLogs}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 text-slate-900 px-4 py-2 text-sm font-semibold hover:bg-slate-200 transition"
              >
                <RefreshCcw className="h-4 w-4" />
                Tải lại server
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800 transition"
              >
                <ClipboardCopy className="h-4 w-4" />
                Sao chép
              </button>
              <button
                type="button"
                onClick={handleDeleteAllLogs}
                className="inline-flex items-center gap-2 rounded-2xl bg-rose-500 text-white px-4 py-2 text-sm font-semibold hover:bg-rose-600 transition"
              >
                <Trash2 className="h-4 w-4" />
                Xóa tất cả
              </button>
            </div>
          </div>

          {loadingServerLogs ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-slate-500">
              Đang tải log từ server...
            </div>
          ) : errorLoadingServerLogs ? (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-10 text-center text-rose-700">
              {errorLoadingServerLogs}
            </div>
          ) : displayedLogs.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-slate-500">
              Chưa có log nào được ghi lại.
            </div>
          ) : (
            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-2">
              {displayedLogs.map((entry) => (
                <div key={entry.id} className="rounded-3xl border border-slate-200 bg-white shadow-sm p-4 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full"
                    style={{ backgroundColor: {
                      log: '#a1a1aa',
                      info: '#3b82f6',
                      warn: '#f59e0b',
                      error: '#ef4444',
                      debug: '#8b5cf6',
                      event: '#22c55e',
                    }[entry.level] || '#a1a1aa' }}></div>
                  <div className="pl-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.25em] text-slate-500 font-semibold mb-2">
                      <span className="font-bold"
                        style={{ color: {
                          log: '#a1a1aa',
                          info: '#3b82f6',
                          warn: '#f59e0b',
                          error: '#ef4444',
                          debug: '#8b5cf6',
                          event: '#22c55e',
                        }[entry.level] || '#a1a1aa' }}
                      >{entry.level}</span>
                      <span className="text-slate-400 text-right">{formatTimestamp(entry.timestamp)}</span>
                    </div>
                    <pre className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{formatLogDetails(entry)}</pre>
                    {entry.userId || entry.userAgent ? (
                      <div className="mt-3 text-[11px] text-slate-400 space-y-1">
                        {entry.userId ? <div>User: {entry.userId}</div> : null}
                        {entry.userAgent ? <div>UA: {entry.userAgent}</div> : null}
                      </div>
                    ) : null}
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleDeleteLog(entry.id)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-rose-500 text-white px-3 py-2 text-xs font-semibold hover:bg-rose-600 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Xóa log
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogBody>

        <DialogFooter className="justify-end gap-2 p-6 pt-4 border-t border-slate-100">
          <DialogCancel className="px-6 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 border-none font-bold text-sm">Đóng</DialogCancel>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
