'use client';

import { useEffect, useState } from 'react';
import { dataStore } from '@/lib/data-store';
import type { JobApplication } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { 
  Inbox, 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileText, 
  Search, 
  Phone, 
  Mail, 
  ArrowRight,
  User,
  ExternalLink,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function RecruitmentResultPage() {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<JobApplication[]>([]);
  const [selected, setSelected] = useState<JobApplication | null>(null);
  const [searching, setSearching] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [searchMode, setSearchMode] = useState<'phone' | 'email'>('phone');

  useEffect(() => {
    const unsubscribe = dataStore.subscribeToJobApplications((apps) => {
      setApplications(apps);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const qRaw = query.trim();
    if (!qRaw) {
      setMatches([]);
      setSelected(null);
      setValidationMessage('');
      setSearching(false);
      return;
    }

    setSearching(true);
    const t = setTimeout(() => {
      if (searchMode === 'email') {
        const qSan = qRaw.replace(/\s+/g, '').toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(qSan)) {
          setValidationMessage('Email không hợp lệ. Vui lòng nhập đúng định dạng.');
          setMatches([]);
          setSelected(null);
          setSearching(false);
          return;
        }
        const found = applications.filter(a => ((a.email || '').toLowerCase() === qSan));
        setMatches(found);
        setSelected(found[0] ?? null);
        setValidationMessage('');
        setSearching(false);
        return;
      }

      const digits = qRaw.replace(/\D/g, '');
      if (digits.length === 0) {
        setValidationMessage('Vui lòng chỉ nhập chữ số.');
        setMatches([]);
        setSelected(null);
        setSearching(false);
        return;
      }
      if (digits.length < 9) {
        setValidationMessage('SĐT phải có ít nhất 9 chữ số.');
        setMatches([]);
        setSelected(null);
        setSearching(false);
        return;
      }

      const found = applications.filter(a => {
        const phoneDigits = (a.phone || '').replace(/\D/g, '');
        return phoneDigits.includes(digits);
      });

      setMatches(found.slice(0, 10));
      setSelected(found[0] ?? null);
      setValidationMessage('');
      setSearching(false);
    }, 400);

    return () => clearTimeout(t);
  }, [query, applications, searchMode]);

  const getStatusInfo = (status: JobApplication['status']) => {
    switch (status) {
      case 'pending':
        return { label: 'Đang chờ duyệt', icon: Clock, color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' };
      case 'reviewed':
        return { label: 'Đã xem hồ sơ', icon: Inbox, color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' };
      case 'rejected':
        return { label: 'Không phù hợp', icon: XCircle, color: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' };
      case 'hired':
        return { label: 'Trúng tuyển', icon: CheckCircle, color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' };
      default:
        return { label: status, icon: Inbox, color: 'bg-slate-50 text-slate-700 border-slate-200', dot: 'bg-slate-400' };
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center py-12 px-4 md:px-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl space-y-8"
      >
        {/* Header Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-blue-600 rounded-[2rem] shadow-xl shadow-blue-200 mb-2">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900">
            Kết quả Tuyển dụng
          </h1>
          <p className="text-slate-500 font-medium max-w-md mx-auto leading-relaxed">
            Tra cứu trạng thái hồ sơ ứng tuyển của bạn tại <span className="text-blue-600 font-bold">Katrina One</span> một cách nhanh chóng.
          </p>
        </div>

        {/* Search Console */}
        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/60 p-6 md:p-8 border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
            <Search className="h-32 w-32 text-slate-900" />
          </div>

          <div className="relative space-y-6">
            {/* Mode Selector */}
            <div className="flex p-1.5 bg-slate-100 rounded-2xl w-fit mx-auto md:mx-0">
              <button
                onClick={() => { setSearchMode('phone'); setQuery(''); }}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all",
                  searchMode === 'phone' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <Phone className="h-4 w-4" /> SĐT
              </button>
              <button
                onClick={() => { setSearchMode('email'); setQuery(''); }}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all",
                  searchMode === 'email' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <Mail className="h-4 w-4" /> Email
              </button>
            </div>

            {/* Input Group */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1 group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                  {searchMode === 'phone' ? <Phone className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
                </div>
                <Input
                  placeholder={searchMode === 'phone' ? 'Nhập SĐT của bạn...' : 'Nhập email ứng tuyển...'}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-14 h-16 rounded-2xl border-slate-200 bg-slate-50/50 text-lg font-bold focus:bg-white transition-all shadow-inner border-2 focus:ring-4 focus:ring-blue-50"
                />
              </div>
              <Button
                onClick={() => setQuery('')}
                variant="ghost"
                className="h-16 px-8 rounded-2xl font-black text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all shrink-0"
              >
                Xóa
              </Button>
            </div>

            {/* Status Messages */}
            <AnimatePresence mode="wait">
              {!query.trim() ? (
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex items-center justify-center md:justify-start gap-2 text-slate-400 font-bold text-sm"
                >
                  <ArrowRight className="h-4 w-4 text-blue-400" />
                  Bạn cần nhập {searchMode === 'phone' ? 'số điện thoại' : 'đúng định dạng email'} để tìm kiếm.
                </motion.div>
              ) : validationMessage ? (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-2 text-rose-500 font-black text-sm"
                >
                  <XCircle className="h-4 w-4" /> {validationMessage}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        {/* Results Section */}
        <AnimatePresence>
          {query.trim() && !validationMessage && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              {loading ? (
                <div className="flex flex-col items-center py-12 space-y-4">
                  <div className="h-12 w-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                  <p className="text-slate-400 font-bold">Đang tra cứu dữ liệu...</p>
                </div>
              ) : matches.length === 0 ? (
                <div className="bg-white rounded-[2.5rem] p-12 text-center border-2 border-dashed border-slate-200 space-y-4">
                  <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                    <Inbox className="h-10 w-10 text-slate-300" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Không tìm thấy hồ sơ</h3>
                    <p className="text-slate-500 font-medium">Vui lòng kiểm tra lại thông tin {searchMode === 'phone' ? 'số điện thoại' : 'email'} của bạn.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Match Count Header */}
                  <div className="flex items-center justify-between px-4">
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">
                      Tìm thấy {matches.length} kết quả
                    </p>
                    {searching && <span className="text-xs text-blue-500 animate-pulse font-bold">Cập nhật...</span>}
                  </div>

                  {/* Horizontal Match List for multiple results */}
                  {matches.length > 1 && (
                    <div className="flex gap-3 overflow-x-auto pb-4 px-1 no-scrollbar">
                      {matches.map((app) => (
                        <button
                          key={app.id}
                          onClick={() => setSelected(app)}
                          className={cn(
                            "flex-shrink-0 flex items-center gap-3 p-4 rounded-2xl border-2 transition-all",
                            selected?.id === app.id 
                              ? "bg-white border-blue-600 shadow-xl shadow-blue-100" 
                              : "bg-white border-transparent hover:border-slate-200"
                          )}
                        >
                          <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden font-black text-slate-500">
                            {app.fullName.split(' ').slice(-1)[0][0]}
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-black text-slate-900 leading-none">{app.fullName}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{app.position}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Main Result Card */}
                  {selected && (
                    <motion.div
                      layoutId="selected-card"
                      className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 overflow-hidden border border-slate-100"
                    >
                      <div className="bg-slate-900 p-8 md:p-10 text-white relative">
                        <div className="absolute top-0 right-0 p-10 opacity-10">
                          <CheckCircle className="h-32 w-32" />
                        </div>
                        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="flex items-center gap-6">
                            <div className="h-20 w-20 md:h-24 md:w-24 rounded-[2rem] bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center overflow-hidden shrink-0 shadow-2xl">
                              {selected.photoUrl ? (
                                <img src={selected.photoUrl} alt={selected.fullName} className="w-full h-full object-cover" />
                              ) : (
                                <User className="h-10 w-10 text-white" />
                              )}
                            </div>
                            <div className="space-y-1">
                              <h2 className="text-2xl md:text-3xl font-black tracking-tight">{selected.fullName}</h2>
                              <div className="flex flex-wrap gap-2 pt-1">
                                <Badge className="bg-blue-600 hover:bg-blue-600 text-white font-black px-3 border-none">
                                  {selected.position}
                                </Badge>
                                <Badge className="bg-white/10 hover:bg-white/20 text-white/80 font-bold border-none">
                                  {selected.gender} • {selected.birthYear}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="text-left md:text-right shrink-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-1">Mã ứng viên</p>
                            <p className="text-sm font-mono font-bold text-white/90">#{selected.id.slice(-6).toUpperCase()}</p>
                          </div>
                        </div>
                      </div>

                      <div className="p-8 md:p-10 space-y-8">
                        {/* Status Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className={cn(
                            "p-6 rounded-3xl border-2 flex items-center justify-between group transition-all",
                            getStatusInfo(selected.status).color
                          )}>
                            <div className="space-y-1">
                              <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Trạng thái hiện tại</p>
                              <p className="text-lg font-black">{getStatusInfo(selected.status).label}</p>
                            </div>
                            <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm", getStatusInfo(selected.status).color.replace('bg-', 'bg-').replace('50', '200'))}>
                              {(() => {
                                const Icon = getStatusInfo(selected.status).icon;
                                return <Icon className="h-6 w-6" />;
                              })()}
                            </div>
                          </div>

                          <div className="p-6 rounded-3xl border-2 border-slate-50 bg-slate-50/30 space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ngày nộp hồ sơ</p>
                            <p className="text-lg font-black text-slate-700">
                              {format(new Date(selected.createdAt), 'dd MMMM, yyyy', { locale: vi })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-center py-8">
          <p className="text-xs text-slate-400 font-bold max-w-sm mx-auto leading-relaxed">
            Nếu có bất kỳ thắc mắc nào về kết quả, vui lòng liên hệ trực tiếp qua số Hotline cửa hàng hoặc trao đổi tại buổi phỏng vấn.
          </p>
        </div>
      </motion.div>

      {/* Global CSS for hiding scrollbar */}
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
