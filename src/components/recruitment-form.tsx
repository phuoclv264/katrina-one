'use client';

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import {
  Loader2,
  User,
  Phone,
  Mail,
  Calendar,
  Briefcase,
  Camera,
  Upload,
  X,
  CheckCircle2,
  Sparkles,
  Info,
  ArrowRight,
  ExternalLink,
  Copy
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/pro-toast';
import { dataStore } from '@/lib/data-store';
import { uploadFile } from '@/lib/data-store-helpers';
import { photoStore } from '@/lib/photo-store';
import type { UserRole, RecruitmentQuestion } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import CameraDialog from './camera-dialog';

export function RecruitmentForm({ onSuccess }: { onSuccess?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedBlob, setSelectedBlob] = useState<Blob | null>(null);
  const [questions, setQuestions] = useState<RecruitmentQuestion[]>([]);
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useState(() => {
    dataStore.getAppSettings().then(settings => {
      if (settings.recruitmentQuestions) {
        setQuestions(settings.recruitmentQuestions);
      }
    });
  });

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    birthYear: new Date().getFullYear() - 20,
    gender: 'Nam' as 'Nam' | 'Nữ' | 'Khác',
    position: '' as UserRole | '',
    experience: '',
    note: '',
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Ảnh quá lớn. Vui lòng chọn ảnh dưới 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
        setSelectedBlob(file);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCameraCapture = async (media: { id: string; type: 'photo' | 'video' }[]) => {
    if (media.length > 0) {
      const photoId = media[0].id;
      const blob = await photoStore.getPhoto(photoId);
      if (blob) {
        const url = URL.createObjectURL(blob);
        setPhotoPreview(url);
        setSelectedBlob(blob);
      }
    }
  };

  const removePhoto = () => {
    setPhotoPreview(null);
    setSelectedBlob(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Now includes formData.position check
    if (!formData.fullName || !formData.phone || !formData.email || !formData.position) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc.');
      return;
    }

    if (!selectedBlob) {
      toast.error('Vui lòng cung cấp ảnh chân dung rõ mặt của bạn.');
      return;
    }

    setLoading(true);
    try {
      let photoUrl = '';
      if (selectedBlob) {
        const path = `recruitment/${Date.now()}-${formData.fullName.replace(/\s+/g, '-').toLowerCase()}.jpg`;
        photoUrl = await uploadFile(selectedBlob, path);
      }

      await dataStore.submitJobApplication({
        ...formData,
        position: formData.position as UserRole,
        photoUrl,
        customAnswers,
      });

      setShowSuccessDialog(true);

      // Reset form
      setFormData({
        fullName: '',
        phone: '',
        email: '',
        birthYear: new Date().getFullYear() - 20,
        gender: 'Nam',
        position: '',
        experience: '',
        note: '',
      });
      setPhotoPreview(null);
      setSelectedBlob(null);
      setCustomAnswers({});

      onSuccess?.();
    } catch (error) {
      console.error('Failed to submit application:', error);
      toast.error('Có lỗi xảy ra. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  const adjustTextareaHeight = (element: HTMLTextAreaElement) => {
    element.style.height = 'inherit';
    // If empty, we want it to be at least big enough for the placeholder
    // but scrollHeight with value='' doesn't always reflect placeholder height.
    const currentVal = element.value;
    if (!currentVal && element.placeholder) {
      // Temporarily set value to placeholder to measure
      element.value = element.placeholder;
      element.style.height = `${element.scrollHeight}px`;
      element.value = '';
    } else {
      element.style.height = `${element.scrollHeight}px`;
    }
  };

  useEffect(() => {
    // Initial height adjustment for all textareas
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach((ta) => adjustTextareaHeight(ta as HTMLTextAreaElement));
  }, [questions]); // Re-run when questions are loaded from settings

  return (
    <div className="max-w-6xl mx-auto px-1 sm:px-4 py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl shadow-blue-900/10 overflow-hidden border border-slate-100"
      >
        <form onSubmit={handleSubmit} className="flex flex-col">
          {/* Header Banner - Responsive Padding */}
          <div className="bg-[#0f172a] p-8 sm:p-14 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-full bg-primary/20 blur-[100px] -z-0 rotate-12" />
            <div className="absolute -bottom-[50%] -left-[10%] w-[300px] h-[300px] bg-blue-600/20 blur-[80px] -z-0" />

            <div className="relative z-10 text-center sm:text-left">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/80 text-[10px] font-black uppercase tracking-[0.2em] mb-6 backdrop-blur-md border border-white/10"
              >
                <Sparkles className="h-3 w-3 text-yellow-400" />
                <span>Career Opportunities</span>
              </motion.div>

              <motion.h1
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-3xl sm:text-5xl font-black tracking-tighter mb-4 leading-none"
              >
                Gia nhập <span className="text-primary underline decoration-primary/30 underline-offset-8">Katrina Coffee</span>
              </motion.h1>
              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-slate-400 max-w-lg font-medium text-sm sm:text-lg mx-auto sm:mx-0 leading-relaxed"
              >
                Cảm ơn bạn đã quan tâm. Vui lòng hoàn thành hồ sơ dưới đây, Katrina Team sẽ sớm phản hồi bạn.
              </motion.p>
            </div>
          </div>

          <div className="p-3 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            {/* Left Column: Photo & Brief Info - Responsive Alignment */}
            <div className="lg:col-span-3 flex flex-col items-center gap-6">
              <div className="w-full flex flex-col items-center sm:items-start text-center sm:text-left">
                <Label className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-4 block">
                  Ảnh Chân Dung <span className="text-rose-500 font-black">*</span>
                </Label>
                <div className="relative group">
                  <div className={cn(
                    "w-48 h-64 sm:w-56 sm:h-72 rounded-3xl overflow-hidden border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center transition-all duration-300 shadow-inner",
                    photoPreview ? "border-solid border-blue-500 bg-white" : "hover:border-blue-400 hover:bg-blue-50/30",
                    !photoPreview && "group-hover:ring-4 group-hover:ring-blue-500/10"
                  )}>
                    {photoPreview ? (
                      <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-3 p-6 text-center">
                        <div className="h-12 w-12 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-400">
                          <User className="h-6 w-6" />
                        </div>
                        <p className="text-xs text-slate-400 font-medium">Vui lòng cung cấp ảnh chân dung rõ mặt</p>
                      </div>
                    )}
                  </div>

                  <AnimatePresence>
                    {photoPreview ? (
                      <motion.button
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        type="button"
                        onClick={removePhoto}
                        className="absolute -top-2 -right-2 h-8 w-8 bg-white text-rose-500 rounded-full shadow-lg flex items-center justify-center border border-rose-100 hover:bg-rose-50 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </motion.button>
                    ) : null}
                  </AnimatePresence>
                </div>

                <div className="flex gap-3 mt-6 w-full max-w-[280px] lg:max-w-none">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 rounded-2xl h-11 gap-2 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-sm active:scale-95 transition-all"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 text-indigo-600" /> Tải Lên
                  </Button>
                  <input
                    type="file"
                    className="hidden"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </div>
              </div>

              <div className="w-full p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 shadow-sm">
                <div className="flex gap-2 text-amber-800 mb-2">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Cam Kết Bảo Mật</span>
                </div>
                <p className="text-[11px] text-amber-700/80 leading-relaxed font-semibold">
                  Mọi thông tin bạn cung cấp sẽ chỉ được dùng cho mục đích tuyển dụng và được bảo mật tuyệt đối theo chính sách của Katrina Coffee.
                </p>
              </div>
            </div>

            {/* Right Column: Form Fields */}
            <div className="lg:col-span-9 flex flex-col gap-8">
              <section className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-8 w-1.5 bg-blue-500 rounded-full" />
                  <h2 className="font-black text-slate-800 text-base uppercase tracking-tight">Thông Tin Cá Nhân</h2>
                </div>

                <div className="grid gap-5">
                  <div>
                    <Label htmlFor="fullName" className="text-slate-500 font-bold text-[11px] uppercase ml-1 mb-2 block">Họ và tên <span className="text-rose-500 font-black">*</span></Label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center text-slate-400 group-focus-within:text-blue-500 transition-colors">
                        <User className="h-4 w-4" />
                      </div>
                      <Input
                        id="fullName"
                        placeholder="Nguyễn Văn A"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        className="pl-11 h-12 bg-white border-slate-200 hover:border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl transition-all font-bold text-slate-700"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <Label htmlFor="phone" className="text-slate-500 font-bold text-[11px] uppercase ml-1 mb-2 block">Số điện thoại <span className="text-rose-500">*</span></Label>
                      <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center text-slate-400 group-focus-within:text-blue-500 transition-colors">
                          <Phone className="h-4 w-4" />
                        </div>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="09xx xxx xxx"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="pl-11 h-12 bg-white border-slate-200 hover:border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl transition-all font-bold text-slate-700"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="email" className="text-slate-500 font-bold text-[11px] uppercase ml-1 mb-2 block">Email <span className="text-rose-500">*</span></Label>
                      <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center text-slate-400 group-focus-within:text-blue-500 transition-colors">
                          <Mail className="h-4 w-4" />
                        </div>
                        <Input
                          id="email"
                          type="email"
                          placeholder="example@gmail.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="pl-11 h-12 bg-white border-slate-200 hover:border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl transition-all font-bold text-slate-700"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <Label htmlFor="birthYear" className="text-slate-500 font-bold text-[11px] uppercase ml-1 mb-2 block text-xs">Năm sinh</Label>
                      <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center text-slate-400 group-focus-within:text-blue-500 transition-colors">
                          <Calendar className="h-4 w-4" />
                        </div>
                        <Input
                          id="birthYear"
                          type="number"
                          value={formData.birthYear}
                          onChange={(e) => setFormData({ ...formData, birthYear: parseInt(e.target.value) })}
                          className="pl-11 h-12 bg-white border-slate-200 hover:border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl transition-all font-bold text-slate-700"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="gender" className="text-slate-500 font-bold text-[11px] uppercase ml-1 mb-2 block text-xs">Giới tính</Label>
                      <Select value={formData.gender} onValueChange={(value: any) => setFormData({ ...formData, gender: value })}>
                        <SelectTrigger className="h-12 bg-white border-slate-200 hover:border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl transition-all font-bold text-slate-700">
                          <SelectValue placeholder="Chọn giới tính" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          <SelectItem value="Nam">Nam</SelectItem>
                          <SelectItem value="Nữ">Nữ</SelectItem>
                          <SelectItem value="Khác">Khác</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-8 w-1.5 bg-indigo-500 rounded-full" />
                  <h2 className="font-black text-slate-800 text-base uppercase tracking-tight">Nguyện Vọng & Kinh Nghiệm</h2>
                </div>

                <div className="grid gap-5">
                  <div>
                    <Label htmlFor="position" className="text-slate-500 font-bold text-[11px] uppercase ml-1 mb-2 block">
                      Vị trí ứng tuyển <span className="text-rose-500 font-black">*</span>
                    </Label>
                    <Select value={formData.position} onValueChange={(value: any) => setFormData({ ...formData, position: value })}>
                      <SelectTrigger className="h-14 bg-blue-50/50 border-blue-100 hover:border-blue-300 focus:ring-blue-500/10 rounded-2xl transition-all px-4 group">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                              <Briefcase className="h-4 w-4" />
                            </div>
                            <div className="text-left">
                              <SelectValue placeholder="Chọn vị trí" />
                            </div>
                          </div>
                        </div>
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        className="rounded-2xl p-1 w-[var(--radix-select-trigger-width)]"
                      >
                        <SelectItem value="Phục vụ" className="rounded-xl font-bold py-3 text-sm">
                          Phục vụ – 18–24k/giờ (tuỳ năng lực)
                        </SelectItem>
                        <SelectItem value="Pha chế" className="rounded-xl font-bold py-3 text-sm">
                          Pha chế – 20–24k/giờ (Part-time) | 25–30k/giờ (Full-time)
                        </SelectItem>
                        <SelectItem value="Quản lý" className="rounded-xl font-bold py-3 text-sm">Quản lý</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="experience" className="text-slate-500 font-bold text-[11px] uppercase ml-1 mb-2 block text-xs">Kinh nghiệm làm việc</Label>
                    <Textarea
                      id="experience"
                      placeholder="Hãy chia sẻ chi tiết về những công việc liên quan mà bạn đã từng làm..."
                      value={formData.experience}
                      onChange={(e) => {
                        setFormData({ ...formData, experience: e.target.value });
                        adjustTextareaHeight(e.target);
                      }}
                      className="min-h-[48px] bg-white border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl transition-all font-bold p-4 resize-none text-slate-700 shadow-sm overflow-hidden"
                    />
                  </div>

                  {/* Custom Questions Section */}
                  {questions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6 pt-4"
                    >
                      <Separator className="bg-slate-200/60" />
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-indigo-500" />
                        <h3 className="font-black text-slate-700 text-[10px] uppercase tracking-widest">Câu hỏi bổ sung</h3>
                      </div>

                      <div className="grid gap-6">
                        {questions.map((q) => (
                          <div key={q.id} className="space-y-3">
                            <Label className="text-slate-700 font-bold text-sm ml-1 leading-snug">
                              {q.question} {q.required && <span className="text-rose-500">*</span>}
                            </Label>

                            {q.type === 'text' && (
                              <Textarea
                                placeholder="Câu trả lời của bạn..."
                                value={customAnswers[q.id] || ''}
                                onChange={(e) => {
                                  setCustomAnswers({ ...customAnswers, [q.id]: e.target.value });
                                  adjustTextareaHeight(e.target);
                                }}
                                className="min-h-[48px] bg-white border-slate-200 focus:border-blue-500 rounded-xl font-bold text-slate-700 shadow-sm resize-none overflow-hidden"
                                required={q.required}
                              />
                            )}

                            {q.type === 'yes_no' && (
                              <div className="flex gap-3">
                                {['Có', 'Không'].map((opt: string) => (
                                  <Button
                                    key={opt}
                                    type="button"
                                    variant={customAnswers[q.id] === opt ? 'default' : 'outline'}
                                    onClick={() => setCustomAnswers({ ...customAnswers, [q.id]: opt })}
                                    className={cn(
                                      "flex-1 h-12 rounded-xl font-bold text-sm transition-all shadow-sm",
                                      customAnswers[q.id] === opt
                                        ? "bg-indigo-600 text-white shadow-indigo-200"
                                        : "bg-white text-slate-600 hover:bg-slate-50 border-slate-200"
                                    )}
                                  >
                                    {opt}
                                  </Button>
                                ))}
                              </div>
                            )}

                            {q.type === 'multiple_choice' && q.options && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {q.options.map((opt: string) => (
                                  <Button
                                    key={opt}
                                    type="button"
                                    variant={customAnswers[q.id] === opt ? 'default' : 'outline'}
                                    onClick={() => setCustomAnswers({ ...customAnswers, [q.id]: opt })}
                                    className={cn(
                                      "justify-start h-auto py-3 px-4 rounded-xl font-bold text-sm text-left transition-all shadow-sm",
                                      customAnswers[q.id] === opt
                                        ? "bg-indigo-600 text-white shadow-indigo-200 border-indigo-600"
                                        : "bg-white text-slate-600 hover:bg-slate-50 border-slate-200"
                                    )}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={cn(
                                        "h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0",
                                        customAnswers[q.id] === opt ? "border-white" : "border-slate-300"
                                      )}>
                                        {customAnswers[q.id] === opt && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                                      </div>
                                      {opt}
                                    </div>
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  <div>
                    <Label htmlFor="note" className="text-slate-500 font-bold text-[11px] uppercase ml-1 mb-2 block text-xs">Ghi chú thêm (Tùy chọn)</Label>
                    <Textarea
                      id="note"
                      placeholder="Ưu điểm, mong muốn riêng..."
                      value={formData.note}
                      onChange={(e) => {
                        setFormData({ ...formData, note: e.target.value });
                        adjustTextareaHeight(e.target);
                      }}
                      className="min-h-[48px] bg-white border-slate-200 focus:border-blue-500 rounded-xl transition-all font-bold text-slate-700 resize-none overflow-hidden"
                    />
                  </div>
                </div>
              </section>

              <div className="mt-12 flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-8 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setFormData({ fullName: '', phone: '', email: '', birthYear: new Date().getFullYear() - 20, gender: 'Nam', position: '', experience: '', note: '' });
                    removePhoto();
                  }}
                  className="w-full sm:w-auto rounded-2xl px-8 h-14 text-slate-400 font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all"
                >
                  Xóa Thông Tin
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto rounded-2xl px-12 h-14 bg-slate-900 hover:bg-primary text-white font-black uppercase tracking-[0.15em] text-[11px] shadow-2xl shadow-slate-200 transition-all active:scale-95 disabled:opacity-70 group"
                >
                  {loading ? (
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Đang Xử Lý...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span>Nộp Hồ Sơ Ứng Tuyển</span>
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </motion.div>

      <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <AlertDialogContent className="rounded-[2.5rem] border-slate-100 p-6 sm:p-8 max-w-md">
          <AlertDialogHeader className="items-center text-center">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mb-4 shadow-inner ring-8 ring-emerald-50/50 mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <AlertDialogTitle className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter mb-2">
              Gửi Hồ Sơ Thành Công!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm sm:text-base text-slate-500 font-medium leading-relaxed mb-4">
              Hồ sơ của bạn đã được tiếp nhận. Bạn có thể theo dõi trạng thái và kết quả ứng tuyển tại đường dẫn bên dưới:
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 mb-6">
            <div className="relative group p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:bg-white hover:border-primary/20">
              <div className="flex flex-col gap-1 pr-8">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Link tra cứu kết quả</span>
                <span className="text-sm font-bold text-primary break-all">https://katrinaone.io.vn/recruitment/result</span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText('https://katrinaone.io.vn/recruitment/result');
                  toast.success('Đã sao chép link tra cứu!');
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-primary/10 rounded-lg transition-colors group-hover:text-primary text-slate-400"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setShowSuccessDialog(false)}
              className="w-full rounded-2xl h-14 bg-slate-100 hover:bg-slate-200 text-slate-600 border-none font-black uppercase tracking-widest text-[10px]"
            >
              Đóng
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
