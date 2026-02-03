'use client';

import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter,
  DialogBody,
  DialogAction,
  DialogCancel
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Plus, 
  Trash2, 
  MessageSquare, 
  CheckCircle2, 
  LayoutList,
  X,
  Loader2,
  Sparkles,
  ListPlus
} from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { dataStore } from '@/lib/data-store';
import { RecruitmentQuestion, RecruitmentQuestionType } from '@/lib/types';
import { toast } from '@/components/ui/pro-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

interface RecruitmentSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RecruitmentSettingsDialog({ isOpen, onClose }: RecruitmentSettingsDialogProps) {
  const [questions, setQuestions] = useState<RecruitmentQuestion[]>([]);
  const [recruitmentEnabled, setRecruitmentEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const settings = await dataStore.getAppSettings();
      setQuestions(settings.recruitmentQuestions || []);
      setRecruitmentEnabled(settings.isRecruitmentEnabled !== false);
    } catch (error) {
      toast.error('Không thể tải cài đặt.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuestion = () => {
    const newQuestion: RecruitmentQuestion = {
      id: uuidv4(),
      question: '',
      type: 'text',
      required: false,
    };
    setQuestions([...questions, newQuestion]);
  };

  const handleRemoveQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const handleUpdateQuestion = (id: string, updates: Partial<RecruitmentQuestion>) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const handleSave = async () => {
    if (questions.some(q => !q.question.trim())) {
      toast.error('Vui lòng nhập nội dung cho tất cả câu hỏi.');
      return;
    }

    setSaving(true);
    try {
      await dataStore.updateAppSettings({ 
        recruitmentQuestions: questions,
        isRecruitmentEnabled: recruitmentEnabled
      });
      toast.success('Đã lưu cài đặt tuyển dụng.');
      onClose();
    } catch (error) {
      toast.error('Lỗi khi lưu cài đặt.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={onClose}
      dialogTag="recruitment-settings"
      parentDialogTag="root"
    >
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader variant="premium" iconkey="layout">
          <DialogTitle className="text-xl font-black text-foreground">Cài Đặt Tuyển Dụng</DialogTitle>
          <DialogDescription>Tùy chỉnh các câu hỏi khảo sát thông tin từ ứng viên tiềm năng.</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6 pt-6">
          {/* Recruitment Status Toggle */}
          <div className="p-5 bg-primary/5 border border-primary/10 rounded-3xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-10 w-10 rounded-2xl flex items-center justify-center transition-colors",
                recruitmentEnabled ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
              )}>
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-black text-slate-700 text-sm">Trạng thái tuyển dụng</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {recruitmentEnabled ? 'Đang mở cửa nhận hồ sơ' : 'Đang tạm dừng nhận hồ sơ'}
                </p>
              </div>
            </div>
            <Switch 
              checked={recruitmentEnabled}
              onCheckedChange={setRecruitmentEnabled}
            />
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <LayoutList className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-bold text-slate-700">Danh sách câu hỏi</h3>
              <Badge variant="secondary" className="rounded-full px-2 py-0 h-5 text-[10px] font-black">{questions.length}</Badge>
            </div>
            <DialogAction 
              variant="pastel-blue" 
              size="sm" 
              onClick={handleAddQuestion}
              className="h-10 px-4"
            >
              <Plus className="h-4 w-4 mr-2" /> Thêm câu hỏi
            </DialogAction>
          </div>

          <div className="space-y-4 pb-12">
            <AnimatePresence initial={false} mode="popLayout">
              {questions.map((q, index) => (
                <motion.div
                  key={q.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                  className="p-5 bg-card border border-primary/10 rounded-3xl shadow-sm hover:shadow-md transition-all relative group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-500 text-xs shadow-inner">
                        {index + 1}
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block -mb-0.5">Câu hỏi</span>
                        <span className="text-xs font-bold text-slate-600">ID: {q.id.slice(0, 8)}...</span>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-xl hover:bg-rose-50 hover:text-rose-500 text-slate-300 transition-colors"
                      onClick={() => handleRemoveQuestion(q.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid gap-5">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black text-slate-500 uppercase ml-1 flex items-center gap-2">
                        <MessageSquare className="h-3 w-3" /> Nội dung câu hỏi
                      </Label>
                      <Input
                        placeholder="VD: Bạn đã có kinh nghiệm làm việc tại quán cà phê bao lâu?"
                        value={q.question}
                        onChange={(e) => handleUpdateQuestion(q.id, { question: e.target.value })}
                        className="h-12 bg-slate-50 border-transparent focus:bg-white focus:border-primary/20 rounded-2xl font-bold text-slate-700 transition-all shadow-inner"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-500 uppercase ml-1">Loại phản hồi</Label>
                        <Select
                          value={q.type}
                          onValueChange={(val: RecruitmentQuestionType) => handleUpdateQuestion(q.id, { type: val })}
                        >
                          <SelectTrigger className="h-12 bg-slate-50 border-transparent rounded-2xl font-bold shadow-inner">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-none shadow-2xl">
                            <SelectItem value="text" className="rounded-xl my-1">
                              <div className="flex items-center gap-2">
                                <LayoutList className="h-4 w-4 opacity-50" />
                                <span>Nhập văn bản</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="yes_no" className="rounded-xl my-1">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 opacity-50" />
                                <span>Có / Không</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="multiple_choice" className="rounded-xl my-1">
                              <div className="flex items-center gap-2">
                                <ListPlus className="h-4 w-4 opacity-50" />
                                <span>Nhiều lựa chọn</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between gap-3 h-12 px-4 bg-slate-50 rounded-2xl border border-transparent shadow-inner">
                        <div className="flex items-center gap-2">
                          <Label className={`text-[10px] font-black uppercase tracking-wider transition-colors ${q.required ? 'text-rose-500' : 'text-slate-400'}`}>
                            {q.required ? 'Bắt buộc' : 'Tùy chọn'}
                          </Label>
                        </div>
                        <Switch
                          checked={q.required}
                          onCheckedChange={(checked) => handleUpdateQuestion(q.id, { required: checked })}
                        />
                      </div>
                    </div>

                    {q.type === 'multiple_choice' && (
                      <div className="space-y-3 p-5 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-black text-slate-500 uppercase ml-1 flex items-center gap-2">
                            <ListPlus className="h-3 w-3" /> Các lựa chọn
                          </Label>
                          <Badge variant="outline" className="text-[10px] bg-white border-slate-200">{(q.options || []).length} mục</Badge>
                        </div>
                        <div className="grid gap-2">
                          {(q.options || ['']).map((opt, optIndex) => (
                            <div key={optIndex} className="flex gap-2 group/option">
                              <Input
                                placeholder={`Lựa chọn ${optIndex + 1}`}
                                value={opt}
                                onChange={(e) => {
                                  const newOpts = [...(q.options || [])];
                                  newOpts[optIndex] = e.target.value;
                                  handleUpdateQuestion(q.id, { options: newOpts });
                                }}
                                className="h-10 bg-white border-slate-100 rounded-xl font-medium text-sm focus:ring-4 focus:ring-primary/5 transition-all"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                onClick={() => {
                                  const newOpts = (q.options || []).filter((_, i) => i !== optIndex);
                                  handleUpdateQuestion(q.id, { options: newOpts });
                                }}
                                disabled={(q.options || []).length <= 1}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button 
                            variant="ghost" 
                            className="w-full h-10 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:text-primary hover:bg-primary/5 hover:border-primary/20 font-bold text-xs gap-2 transition-all"
                            onClick={() => {
                              const newOpts = [...(q.options || []), ''];
                              handleUpdateQuestion(q.id, { options: newOpts });
                            }}
                          >
                            <Plus className="h-3 w-3" /> Thêm lựa chọn
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {questions.length === 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-[2.5rem] text-slate-400 bg-slate-50/50"
              >
                <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <MessageSquare className="h-8 w-8 opacity-20" />
                </div>
                <p className="font-black text-sm text-slate-600">Chưa có câu hỏi bổ sung nào</p>
                <p className="text-[10px] uppercase font-bold tracking-widest opacity-60">Hãy bắt đầu bằng cách thêm câu hỏi đầu tiên</p>
                <Button 
                  variant="outline" 
                  className="mt-6 rounded-2xl border-slate-200 font-bold hover:bg-white"
                  onClick={handleAddQuestion}
                >
                  <Plus className="h-4 w-4 mr-2" /> Thêm ngay
                </Button>
              </motion.div>
            )}
          </div>
        </DialogBody>

        <DialogFooter variant="muted" className="shrink-0 flex sm:flex-row flex-col gap-3">
          <DialogCancel className="sm:w-32">Huỷ bỏ</DialogCancel>
          <DialogAction 
            onClick={handleSave}
            isLoading={saving}
            className="sm:px-10 min-w-[160px] shadow-lg shadow-primary/20"
          >
            {!saving && <Sparkles className="h-4 w-4 mr-2" />}
            LƯU THAY ĐỔI
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
