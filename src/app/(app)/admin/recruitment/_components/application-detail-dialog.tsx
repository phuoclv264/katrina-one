'use client';

import { JobApplication } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { 
  X, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Briefcase, 
  Calendar,
  Phone,
  Mail,
  ExternalLink,
  ChevronRight,
  UserCheck,
  UserMinus,
  Sparkles,
  Inbox,
  Copy,
  Check,
  Image as ImageIcon,
  Maximize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dataStore } from '@/lib/data-store';
import type { RecruitmentQuestion } from '@/lib/types';
import { useState, useEffect } from 'react';
import { toast } from '@/components/ui/pro-toast';
import { useLightbox } from '@/contexts/lightbox-context';

interface ApplicationDetailDialogProps {
  application: JobApplication | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus: (id: string, status: JobApplication['status']) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  getStatusBadge: (status: JobApplication['status']) => React.ReactNode;
}

export function ApplicationDetailDialog({
  application,
  isOpen,
  onClose,
  onUpdateStatus,
  onDelete,
  getStatusBadge,
}: ApplicationDetailDialogProps) {
  const [questions, setQuestions] = useState<RecruitmentQuestion[]>([]);
  const [isCopying, setIsCopying] = useState<string | null>(null);
  const { openLightbox } = useLightbox();

  useEffect(() => {
    if (isOpen) {
      dataStore.getAppSettings().then(settings => {
        if (settings.recruitmentQuestions) {
          setQuestions(settings.recruitmentQuestions);
        }
      });
    }
  }, [isOpen]);

  if (!application) return null;

  const handleCopy = (text: string, type: 'phone' | 'email') => {
    navigator.clipboard.writeText(text).then(() => {
      setIsCopying(type);
      toast.success(`Đã sao chép ${type === 'phone' ? 'số điện thoại' : 'email'}`);
      setTimeout(() => setIsCopying(null), 2000);
    });
  };

  return (
    <Dialog 
      open={!!application} 
      onOpenChange={(open) => !open && onClose()}
      dialogTag="recruitment-detail"
      parentDialogTag="root"
    >
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl bg-white">
        <div className="flex flex-col h-full max-h-[92vh]">
          {/* Enhanced Header with Motion */}
          <div className="relative h-32 bg-gradient-to-br from-indigo-600 via-blue-600 to-sky-500 overflow-hidden">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 left-0 w-64 h-64 bg-white/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
              <div className="absolute bottom-0 right-0 w-80 h-80 bg-blue-400/30 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />
            </div>

            <div className="relative h-full flex items-end px-8 pb-4 gap-6">
              <motion.div 
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="h-20 w-20 rounded-3xl bg-white shadow-2xl flex items-center justify-center p-1 border-4 border-white/20 backdrop-blur-sm"
              >
                <div className="h-full w-full rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center text-blue-600 overflow-hidden">
                  {application.photoUrl ? (
                    <img 
                      src={application.photoUrl} 
                      alt={application.fullName} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="h-8 w-8" />
                  )}
                </div>
              </motion.div>
              
              <div className="flex-1 mb-1">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <DialogTitle className="text-2xl font-bold text-white leading-tight drop-shadow-sm">
                    {application.fullName}
                  </DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white text-[10px] font-bold flex items-center gap-1.5 uppercase tracking-wider">
                      <Briefcase className="h-3 w-3" />
                      {application.position}
                    </span>
                    {getStatusBadge(application.status)}
                  </div>
                </motion.div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 bg-[#fdfdff]">
            {/* Action Cards Container */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <motion.div 
                whileHover={{ y: -2 }}
                onClick={() => handleCopy(application.phone, 'phone')}
                className="group relative p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {isCopying === 'phone' ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-blue-500" />}
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                    <Phone className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Số điện thoại</p>
                    <p className="font-bold text-slate-900 text-base group-hover:text-blue-700 transition-colors font-mono">{application.phone}</p>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ y: -2 }}
                onClick={() => handleCopy(application.email, 'email')}
                className="group relative p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {isCopying === 'email' ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-indigo-500" />}
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Mail className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Email liên hệ</p>
                    <p className="font-bold text-slate-900 text-sm truncate group-hover:text-indigo-700 transition-colors">{application.email}</p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Main Info Columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                {/* Photo Section - Added for viewing user images */}
                <section className="space-y-3">
                  <h3 className="flex items-center gap-2 text-[11px] font-bold text-slate-800 uppercase tracking-widest">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    Hình ảnh ứng viên
                  </h3>
                  <div 
                    className="relative group aspect-video sm:aspect-square md:aspect-video rounded-3xl overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer shadow-sm hover:shadow-md transition-all"
                    onClick={() => application.photoUrl && openLightbox([{ src: application.photoUrl }], 0)}
                  >
                    {application.photoUrl ? (
                      <>
                        <img 
                          src={application.photoUrl} 
                          alt="Selfie ứng viên" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <div className="h-12 w-12 rounded-full bg-white/90 shadow-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all">
                            <Maximize2 className="h-6 w-6 text-blue-600" />
                          </div>
                        </div>
                        <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur shadow-sm text-[10px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-1.5">
                          <ImageIcon className="h-3 w-3" /> Chân dung/Selfie
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                        <ImageIcon className="h-10 w-10 opacity-20" />
                        <p className="text-xs font-bold uppercase tracking-widest opacity-50">Không có ảnh hồ sơ</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* CV Content Section */}
                <section className="space-y-3">
                  <h3 className="flex items-center gap-2 text-[11px] font-bold text-slate-800 uppercase tracking-widest">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    Kinh nghiệm làm việc
                  </h3>
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl blur opacity-25 group-hover:opacity-40 transition-opacity" />
                    <div className="relative p-5 bg-white rounded-2xl border border-slate-100 shadow-sm text-slate-700 leading-relaxed text-sm min-h-[120px] whitespace-pre-wrap">
                      {application.experience || (
                        <div className="flex flex-col items-center justify-center py-6 text-slate-400 italic">
                          <Inbox className="h-8 w-8 mb-2 opacity-20" />
                          Chưa có thông tin kinh nghiệm
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {/* Additional Note */}
                {application.note && (
                  <section className="space-y-3">
                    <h3 className="flex items-center gap-2 text-[11px] font-bold text-slate-800 uppercase tracking-widest">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                      Ghi chú bổ sung
                    </h3>
                    <div className="p-4 bg-indigo-50/20 rounded-2xl border border-indigo-100 text-slate-600 text-sm italic leading-relaxed">
                      "{application.note}"
                    </div>
                  </section>
                )}

                {/* Custom User Answers */}
                {application.customAnswers && Object.keys(application.customAnswers).length > 0 && (
                  <section className="space-y-4">
                    <h3 className="flex items-center gap-2 text-[11px] font-bold text-slate-800 uppercase tracking-widest">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Thông tin bổ sung từ câu hỏi
                    </h3>
                    <div className="grid gap-3">
                      {Object.entries(application.customAnswers).map(([qId, answer]) => {
                        const question = questions.find(q => q.id === qId);
                        return (
                          <div key={qId} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                              {question ? question.question : `Câu hỏi #${qId.slice(0, 4)}`}
                            </p>
                            <p className="text-sm font-bold text-slate-700 leading-snug">{answer}</p>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>

              {/* Sidebar Info */}
              <div className="space-y-6">
                <section className="space-y-3">
                  <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-widest px-1">Thông tin bổ sung</h3>
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-500 text-[10px] font-medium uppercase tracking-tight">
                        <Calendar className="h-3 w-3" /> Năm sinh
                      </div>
                      <span className="font-bold text-slate-900 text-sm">{application.birthYear}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-500 text-[10px] font-medium uppercase tracking-tight">
                        <User className="h-3 w-3" /> Giới tính
                      </div>
                      <span className="font-bold text-slate-900 text-sm">{application.gender}</span>
                    </div>
                    <div className="h-px bg-slate-200" />
                    <div className="pt-0.5">
                      <div className="flex items-center gap-2 text-slate-500 text-[10px] font-medium uppercase tracking-tight mb-1.5">
                        <Clock className="h-3 w-3" /> Thời gian gửi
                      </div>
                      <div className="text-xs font-bold text-slate-900">
                        {format(new Date(application.createdAt), 'HH:mm - dd/MM/yyyy', { locale: vi })}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>

          {/* New Footer Actions */}
          <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)]">
            <div className="hidden sm:block">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Id Hồ sơ</p>
              <p className="text-[9px] font-mono text-slate-300">#{application.id.slice(-8).toUpperCase()}</p>
            </div>
            
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                className="h-11 px-4 rounded-xl border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-sm transition-all flex-1 sm:flex-initial"
                onClick={() => onUpdateStatus(application.id, 'reviewed')}
                disabled={application.status === 'reviewed'}
              >
                <Clock className="mr-2 h-4 w-4" /> Xem
              </Button>
              <Button
                variant="outline"
                className="h-11 px-4 rounded-xl text-rose-600 border-rose-100 hover:bg-rose-50 hover:border-rose-200 font-bold text-sm transition-all flex-1 sm:flex-initial"
                onClick={() => onUpdateStatus(application.id, 'rejected')}
                disabled={application.status === 'rejected'}
              >
                <XCircle className="mr-2 h-4 w-4" /> Loại
              </Button>
              <Button
                className="h-11 px-8 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-xl shadow-green-100 font-bold text-sm transition-all flex-1 sm:flex-initial"
                onClick={() => onUpdateStatus(application.id, 'hired')}
                disabled={application.status === 'hired'}
              >
                <CheckCircle className="mr-2 h-4 w-4" /> Nhận
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

