'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogBody,
  DialogAction,
  DialogCancel,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, Edit, Loader2, Check, Save, ShieldCheck, Repeat, ArrowUp, ArrowDown, Shield, LayoutGrid } from 'lucide-react';
import type { ViolationCategory, ViolationCategoryData, FineRule } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { toast } from '@/components/ui/pro-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertDialogIcon,
} from "@/components/ui/alert-dialog";
import { v4 as uuidv4 } from 'uuid';
import { cn, normalizeSearchString } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/combobox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

function RuleEditor({ rule, onUpdate, onDelete, isEditing, onMove, canMoveUp, canMoveDown }: { rule: FineRule, onUpdate: (updatedRule: FineRule) => void, onDelete: () => void, isEditing: boolean, onMove: (direction: 'up' | 'down') => void, canMoveUp: boolean, canMoveDown: boolean }) {
  if (!isEditing) {
    let conditionLabel = '';
    let conditionValue = '';
    if (rule.condition === 'repeat_in_month') {
      conditionLabel = 'Lặp lại';
      conditionValue = `lần thứ ${rule.threshold} trong tháng`;
    } else if (rule.condition === 'is_flagged') {
      conditionLabel = 'Bị gắn cờ';
      conditionValue = 'Có cờ đỏ';
    }

    let actionLabel = '';
    let actionValue = '';
    if (rule.action === 'multiply') {
      actionLabel = 'Nhân tiền';
      actionValue = `x${rule.value}`;
    } else {
      actionLabel = 'Cộng tiền';
      actionValue = `+${rule.value.toLocaleString('vi-VN')}đ`;
    }

    let severityLabel = '';
    if (rule.severityAction === 'increase') {
      severityLabel = 'Gia tăng mức độ';
    } else if (rule.severityAction === 'set_to_high') {
      severityLabel = 'Nghiêm trọng hóa';
    }

    return (
      <div className="group relative flex flex-col gap-3 p-4 rounded-2xl bg-background border border-muted/60 shadow-sm hover:border-primary/30 transition-all duration-200 overflow-hidden">
        {/* Connection line */}
        <div className="absolute left-[22px] top-[34px] bottom-[34px] w-[2px] bg-muted/40 group-hover:bg-primary/20 transition-colors hidden sm:block" />
        
        <div className="flex items-start sm:items-center gap-3 relative">
          <div className="h-4 w-4 rounded-full border-2 border-blue-500/30 bg-background flex items-center justify-center shrink-0 z-10 mt-1 sm:mt-0">
             <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          </div>
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-600/70">Nếu</span>
            <Badge variant="outline" className="h-5 px-1.5 rounded-md bg-blue-500/5 text-blue-600 border-blue-500/20 text-[10px] font-bold whitespace-nowrap shrink-0">
              {conditionLabel}
            </Badge>
            <span className="text-xs font-semibold text-foreground/80">{conditionValue}</span>
          </div>
        </div>

        <div className="flex items-start sm:items-center gap-3 relative">
          <div className="h-4 w-4 rounded-full border-2 border-primary/30 bg-background flex items-center justify-center shrink-0 z-10 mt-1 sm:mt-0">
             <div className="h-1.5 w-1.5 rounded-full bg-primary" />
          </div>
          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider text-primary/70">Thì</span>
              <Badge variant="outline" className="h-5 px-1.5 rounded-md bg-primary/5 text-primary border-primary/20 text-[10px] font-bold whitespace-nowrap shrink-0">
                {actionLabel}
              </Badge>
              <span className="text-xs font-bold text-primary">{actionValue}</span>
            </div>
            
            {severityLabel && (
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-[2px] bg-muted-foreground/30 rounded-full" />
                <Badge variant="outline" className="h-5 px-1.5 rounded-md bg-amber-500/5 text-amber-600 border-amber-500/20 text-[10px] font-bold whitespace-nowrap shrink-0">
                  {severityLabel}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative p-5 rounded-2xl bg-muted/20 border border-muted/40 shadow-inner group/editor overflow-hidden transition-all duration-300">
      {/* Modern Header for Rule Editor */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-background border border-muted/40 shadow-sm">
            <Shield className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="hidden min-[400px]:block">
            <h5 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Cấu hình quy tắc</h5>
            <p className="text-[9px] text-muted-foreground/60 font-medium">Logic phạt tự động</p>
          </div>
          <div className="min-[400px]:hidden">
            <h5 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Quy tắc</h5>
          </div>
        </div>
        
        <div className="flex items-center p-1 rounded-xl bg-background border border-muted/30 shadow-sm scale-90 sm:scale-100 origin-right">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted" onClick={() => onMove('up')} disabled={!canMoveUp}><ArrowUp className="h-4 w-4" /></Button>
          <div className="w-[1px] h-3 bg-muted mx-0.5" />
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted" onClick={() => onMove('down')} disabled={!canMoveDown}><ArrowDown className="h-4 w-4" /></Button>
          <div className="w-[1px] h-3 bg-muted mx-0.5" />
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-red-500 hover:bg-red-500/10" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Section: Condition */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-5 px-2 rounded-full bg-blue-500/10 flex items-center justify-center text-[10px] font-black text-blue-600">NẾU</div>
            <div className="flex-1 h-[1px] bg-blue-500/10" />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Điều kiện áp dụng</Label>
              <Combobox
                value={rule.condition}
                onChange={(v) => onUpdate({ ...rule, condition: v as FineRule['condition'] })}
                options={[
                  { value: "repeat_in_month", label: "Lặp lại trong tháng" },
                  { value: "is_flagged", label: "Bị gắn cờ" }
                ]}
                compact
                searchable={false}
                className="h-10 rounded-xl bg-background border-muted/60"
              />
            </div>
            {rule.condition === 'repeat_in_month' && (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Số lần ngưỡng</Label>
                <div className="relative group/input">
                  <Input 
                    type="number" 
                    value={rule.threshold} 
                    className="h-10 pr-12 rounded-xl bg-background border-muted/60 focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500/50 transition-colors"
                    onChange={(e) => onUpdate({ ...rule, threshold: Number(e.target.value) })} 
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground/40 group-focus-within/input:text-blue-500/60 transition-colors">LẦN</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section: Action */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-5 px-2 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary">THÌ</div>
            <div className="flex-1 h-[1px] bg-primary/10" />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Hình thức phạt</Label>
              <Combobox
                value={rule.action}
                onChange={(v) => onUpdate({ ...rule, action: v as FineRule['action'] })}
                options={[
                  { value: "multiply", label: "Nhân tiền phạt" },
                  { value: "add", label: "Cộng thêm tiền" }
                ]}
                compact
                searchable={false}
                className="h-10 rounded-xl bg-background border-muted/60"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Giá trị áp dụng</Label>
              <div className="relative group/input">
                <Input 
                  type="number" 
                  value={rule.value} 
                  className="h-10 pr-12 rounded-xl bg-background border-muted/60 focus:ring-1 focus:ring-primary/20 focus:border-primary/50 transition-colors"
                  onChange={(e) => onUpdate({ ...rule, value: Number(e.target.value) })} 
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground/40 group-focus-within/input:text-primary transition-colors">
                  {rule.action === 'multiply' ? 'Hệ số X' : 'VNĐ'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Extra */}
        <div className="pt-2 border-t border-muted/40">
           <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Kèm theo thay đổi mức độ</Label>
            <Combobox
              value={rule.severityAction || 'none'}
              onChange={(v) => onUpdate({ ...rule, severityAction: v === 'none' ? null : (v as FineRule['severityAction']) })}
              options={[
                { value: "none", label: "Không đổi" },
                { value: "increase", label: "Tăng 1 cấp độ" },
                { value: "set_to_high", label: "Chuyển thành Nghiêm trọng" }
              ]}
              compact
              searchable={false}
              className="h-10 rounded-xl bg-background border-muted/60"
            />
          </div>
        </div>
      </div>
    </div>
  )
}


export default function ViolationCategoryManagementDialog({ isOpen, onClose, parentDialogTag }: { isOpen: boolean, onClose: () => void, parentDialogTag: string }) {
  const [categoryData, setCategoryData] = useState<ViolationCategoryData>({ list: [], generalRules: [], generalNote: '' });
  const [isLoading, setIsLoading] = useState(true);
  // Require parent dialog tag so caller specifies nesting explicitly
  // (e.g., parentDialogTag="root" or parentDialogTag="violation-dialog").
  // Update signature to accept parentDialogTag.
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [currentEditingValues, setCurrentEditingValues] = useState<Omit<ViolationCategory, 'id'>>({ name: '', severity: 'low', calculationType: 'fixed', fineAmount: 0, finePerUnit: 0, unitLabel: 'phút' });
  const [isEditingGeneralRules, setIsEditingGeneralRules] = useState(false);
  const [tempGeneralRules, setTempGeneralRules] = useState<FineRule[]>([]);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);

  const [newCategoryName, setNewCategoryName] = useState('');
  const itemRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  // Effect to subscribe to data source
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      const unsub = dataStore.subscribeToViolationCategories((data) => {
        if (data && data.list) {
          const sortedList = data.list.sort((a, b) => (a?.name || '').localeCompare(b?.name || '', 'vi'));
          setCategoryData({ list: sortedList, generalNote: data.generalNote, generalRules: data.generalRules || [] });
          setTempGeneralRules(data.generalRules || []);
        } else {
          setCategoryData({ list: [], generalNote: '', generalRules: [] });
          setTempGeneralRules([]);
        }
        setIsLoading(false);
      });
      return () => unsub();
    } else {
      setEditingCategoryId(null);
      setIsEditingGeneralRules(false);
    }
  }, [isOpen]);

  const handleAddNewCategory = () => {
    if (newCategoryName.trim() === '') return;
    if (categoryData.list.some(c => normalizeSearchString(c.name) === normalizeSearchString(newCategoryName))) {
      toast.error('Loại vi phạm này đã tồn tại.');
      return;
    }

    const newCategory: ViolationCategory = {
      id: uuidv4(),
      name: newCategoryName.trim(),
      severity: 'low',
      calculationType: 'fixed',
      fineAmount: 0,
      finePerUnit: 0,
      unitLabel: 'phút',
    };

    const newList = [...categoryData.list, newCategory].sort((a, b) => (a?.name || '').localeCompare(b?.name || '', 'vi'));

    flushSync(() => {
      setCategoryData(prev => ({ ...prev, list: newList }));
      setNewCategoryName('');
    });

    handleSave({ list: newList }); // Save to backend
    setEditingCategoryId(newCategory.id);
    setCurrentEditingValues(newCategory);
    itemRefs.current.get(newCategory.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleSave = async (newData: Partial<ViolationCategoryData>) => {
    try {
      await dataStore.updateViolationCategories({ ...categoryData, ...newData });
    } catch (error) {
      toast.error('Lỗi: Không thể lưu thay đổi.');
      console.error(error);
    }
  }

  const handleSaveCategory = async () => {
    if (!editingCategoryId) return;
    if (!currentEditingValues.name.trim()) {
      toast.error('Tên loại vi phạm không được để trống.');
      return;
    }

    const dataToSave: Partial<Omit<ViolationCategory, 'id'>> = { ...currentEditingValues };

    if (dataToSave.calculationType === 'fixed') {
      dataToSave.finePerUnit = 0;
      dataToSave.unitLabel = null;
    } else {
      dataToSave.fineAmount = 0;
    }

    const newList = categoryData.list.map(c =>
      c.id === editingCategoryId
        ? { id: editingCategoryId, ...dataToSave }
        : c
    ) as ViolationCategory[];

    await handleSave({ list: newList });
    toast.success(`Đã cập nhật "${currentEditingValues.name}".`);
    setEditingCategoryId(null);
  };

  const handleCancelEdit = () => {
    setEditingCategoryId(null);
  };

  const handleEditingValueChange = (field: keyof typeof currentEditingValues, value: any) => {
    setCurrentEditingValues(prev => ({ ...prev, [field]: value }));
  };

  const handleDeleteCategory = async (categoryId: string) => {
    setDeletingCategoryId(categoryId);
    try {
      const newList = categoryData.list.filter(c => c.id !== categoryId);
      await handleSave({ list: newList });
      toast.success('Đã xóa loại vi phạm.');
    } finally {
      setDeletingCategoryId(null);
    }
  };

  const handleAddGeneralRule = () => {
    const newRule: FineRule = {
      id: uuidv4(),
      condition: 'repeat_in_month',
      threshold: 4,
      action: 'multiply',
      value: 2,
      severityAction: null,
    };
    setTempGeneralRules(prev => [...prev, newRule]);
  }

  const handleUpdateGeneralRule = (ruleId: string, updatedRule: FineRule) => {
    setTempGeneralRules(prev => prev.map(r => r.id === ruleId ? updatedRule : r));
  }

  const handleDeleteGeneralRule = (ruleId: string) => {
    setTempGeneralRules(prev => prev.filter(r => r.id !== ruleId));
  }

  const handleSaveGeneralRules = async () => {
    await handleSave({ generalRules: tempGeneralRules });
    toast.success('Đã lưu các quy tắc chung.');
    setIsEditingGeneralRules(false);
  }

  const handleCancelGeneralRulesEdit = () => {
    setTempGeneralRules(categoryData.generalRules || []);
    setIsEditingGeneralRules(false);
  }

  const handleMoveRule = (index: number, direction: 'up' | 'down') => {
    const newRules = [...tempGeneralRules];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newRules.length) return;
    [newRules[index], newRules[newIndex]] = [newRules[newIndex], newRules[index]];
    setTempGeneralRules(newRules);
  };

  const getSeverityBadgeClass = (severity: ViolationCategory['severity']) => {
    switch (severity) {
      case 'high': 
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'medium': 
        return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'low':
      default:
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose} dialogTag="violation-category-management-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-2xl">
        <DialogHeader
          iconkey="event"
          variant="info"
        >
          <DialogTitle>Quản lý Loại Vi phạm</DialogTitle>
          <DialogDescription>
            Thêm, sửa, hoặc xóa các danh mục vi phạm và mức phạt tương ứng.
          </DialogDescription>
        </DialogHeader>
        
        <DialogBody className="p-0">
          <div className="p-6 space-y-8">
            {/* General Rules Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <div className="space-y-0.5">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-blue-500" />
                    Quy tắc phạt chung
                  </h4>
                </div>
                {!isEditingGeneralRules ? (
                  <Button variant="outline" size="sm" className="h-8 rounded-full bg-background font-bold text-[11px] px-3 border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all" onClick={() => setIsEditingGeneralRules(true)}>
                    <Edit className="mr-1.5 h-3 w-3" /> Chỉnh sửa
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="h-8 rounded-full font-bold text-[11px]" onClick={handleCancelGeneralRulesEdit}>Hủy</Button>
                    <Button size="sm" className="h-8 rounded-full font-bold text-[11px] px-3 shadow-md" onClick={handleSaveGeneralRules}><Save className="mr-1.5 h-3 w-3" /> Lưu</Button>
                  </div>
                )}
              </div>

              <div className="space-y-3 p-4 rounded-2xl bg-muted/30 border border-muted/50">
                {(isEditingGeneralRules ? tempGeneralRules : (categoryData.generalRules || [])).map((rule, index) => (
                  <RuleEditor
                    key={rule.id}
                    rule={rule}
                    onUpdate={(updatedRule) => handleUpdateGeneralRule(rule.id, updatedRule)}
                    onDelete={() => handleDeleteGeneralRule(rule.id)}
                    isEditing={isEditingGeneralRules}
                    onMove={(dir) => handleMoveRule(index, dir)}
                    canMoveUp={index > 0}
                    canMoveDown={index < tempGeneralRules.length - 1}
                  />
                ))}
                
                {isEditingGeneralRules && (
                  <Button variant="outline" size="sm" className="w-full h-10 rounded-xl border-dashed bg-background/50 hover:bg-background transition-colors font-semibold text-xs py-0" onClick={handleAddGeneralRule}>
                    <Plus className="mr-1.5 h-4 w-4" /> Thêm quy tắc chung
                  </Button>
                )}
                
                {!isEditingGeneralRules && (categoryData.generalRules || []).length === 0 && (
                  <p className="text-center text-xs text-muted-foreground/60 py-4 italic">Chưa có quy tắc phạt chung nào được thiết lập.</p>
                )}
              </div>
            </div>

            {/* categories List Section */}
            <div className="space-y-5 pt-6 border-t">
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4 text-primary" />
                    Danh sách vi phạm
                  </h4>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "font-bold text-[10px] rounded-full px-2.5 py-0.5 transition-colors duration-300",
                      categoryData.list.length > 0 
                        ? "bg-primary/5 border-primary/20 text-primary" 
                        : "bg-muted border-muted-foreground/10 text-muted-foreground/60"
                    )}
                  >
                    {categoryData.list.length} mục
                  </Badge>
                </div>
                
                <div className="flex gap-2 p-2 rounded-2xl bg-muted/20 border border-muted/30">
                  <Input
                    placeholder="Tên loại vi phạm mới..."
                    value={newCategoryName}
                    className="h-10 rounded-xl bg-background border-muted-foreground/10 focus-visible:ring-primary/20 flex-1"
                    onChange={e => setNewCategoryName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddNewCategory()}
                  />
                  <Button onClick={handleAddNewCategory} className="h-10 w-10 shrink-0 rounded-xl p-0 shadow-sm transition-transform active:scale-95">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                    <p className="text-sm text-muted-foreground font-medium animate-pulse">Đang tải dữ liệu...</p>
                  </div>
                ) : categoryData.list.length > 0 ? (
                  categoryData.list.map(category => (
                    <div
                      key={category.id}
                      ref={(el) => { itemRefs.current.set(category.id, el) }}
                      className={cn(
                        "group p-4 space-y-4 border rounded-2xl transition-all duration-200",
                        editingCategoryId === category.id 
                          ? "bg-primary/5 border-primary/40 ring-1 ring-primary/20 shadow-md" 
                          : "bg-background border-muted-foreground/10 hover:border-primary/30 hover:shadow-sm"
                      )}
                    >
                      {editingCategoryId === category.id ? (
                        // EDITING VIEW
                        <div className="w-full space-y-5">
                          <div className="grid gap-5">
                            <div className="space-y-2">
                              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Tên vi phạm</Label>
                              <Input
                                value={currentEditingValues.name}
                                className="h-10 rounded-xl bg-background border-primary/20 focus-visible:ring-primary/30"
                                onChange={(e) => handleEditingValueChange('name', e.target.value)}
                                placeholder="Nhập tên vi phạm..."
                              />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Mức độ</Label>
                                <Combobox
                                  value={currentEditingValues.severity}
                                  onChange={(val) => handleEditingValueChange('severity', val)}
                                  options={[
                                    { value: "low", label: "Nhẹ" },
                                    { value: "medium", label: "Trung bình" },
                                    { value: "high", label: "Nghiêm trọng" }
                                  ]}
                                  compact
                                  searchable={false}
                                  className="h-10 rounded-xl bg-background border-primary/20"
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Kiểu tính phạt</Label>
                                <RadioGroup
                                  value={currentEditingValues.calculationType}
                                  onValueChange={(val) => handleEditingValueChange('calculationType', val)}
                                  className="flex items-center gap-1.5 h-10 px-3 bg-background border border-primary/20 rounded-xl"
                                >
                                  <div className="flex items-center space-x-2 flex-1">
                                    <RadioGroupItem value="fixed" id={`calc-fixed-${category.id}`} />
                                    <Label htmlFor={`calc-fixed-${category.id}`} className="text-xs font-semibold cursor-pointer">Cố định</Label>
                                  </div>
                                  <div className="flex items-center space-x-2 flex-1">
                                    <RadioGroupItem value="perUnit" id={`calc-unit-${category.id}`} />
                                    <Label htmlFor={`calc-unit-${category.id}`} className="text-xs font-semibold cursor-pointer whitespace-nowrap">Đơn vị</Label>
                                  </div>
                                </RadioGroup>
                              </div>
                            </div>

                            {currentEditingValues.calculationType === 'perUnit' ? (
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Tiền phạt/đơn vị</Label>
                                  <div className="relative">
                                    <Input 
                                      type="number" 
                                      value={currentEditingValues.finePerUnit ?? 0} 
                                      className="h-10 pl-3 pr-10 rounded-xl bg-background border-primary/20"
                                      onChange={(e) => handleEditingValueChange('finePerUnit', parseInt(e.target.value, 10) || 0)} 
                                      onFocus={(e) => e.target.select()} 
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">VND</span>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Tên đơn vị</Label>
                                  <Input 
                                    value={currentEditingValues.unitLabel ?? 'phút'} 
                                    className="h-10 rounded-xl bg-background border-primary/20"
                                    onChange={(e) => handleEditingValueChange('unitLabel', e.target.value)} 
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Mức phạt (VNĐ)</Label>
                                <div className="relative">
                                  <Input 
                                    type="number" 
                                    value={currentEditingValues.fineAmount} 
                                    className="h-10 pl-3 pr-10 rounded-xl bg-background border-primary/20 w-full"
                                    onChange={(e) => handleEditingValueChange('fineAmount', parseInt(e.target.value, 10) || 0)} 
                                    onFocus={(e) => e.target.select()} 
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">VND</span>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex justify-end gap-2 pt-2">
                            <Button size="sm" variant="ghost" className="h-9 rounded-full px-4 text-xs font-bold" onClick={handleCancelEdit}>Hủy</Button>
                            <Button size="sm" className="h-9 rounded-full px-5 text-xs font-bold shadow-sm" onClick={handleSaveCategory}>
                              <Check className="mr-1.5 h-3.5 w-3.5" /> Lưu thay đổi
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // DISPLAY VIEW
                        <div className="flex items-center gap-4">
                          <div className="flex-1 min-w-0 space-y-2">
                            <p className="font-bold text-foreground leading-tight text-base">{category.name}</p>
                            <div className="flex items-center gap-2">
                              <Badge className={cn("text-[10px] font-black h-5 px-2 rounded-md border-transparent tracking-wide pointer-events-none whitespace-nowrap shrink-0", getSeverityBadgeClass(category.severity))}>
                                {category.severity === 'low' ? 'NHẸ' : category.severity === 'medium' ? 'TRUNG BÌNH' : 'NGHIÊM TRỌNG'}
                              </Badge>
                              <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                              {category.calculationType === 'perUnit' ? (
                                <span className="text-sm font-bold text-muted-foreground/90">
                                  {(category.finePerUnit ?? 0).toLocaleString('vi-VN')}
                                  <span className="text-[10px] opacity-70 ml-0.5">đ</span>
                                  <span className="mx-1 text-muted-foreground/40 font-normal">/</span>
                                  {category.unitLabel || 'đơn vị'}
                                </span>
                              ) : (
                                <span className="text-sm font-bold text-muted-foreground/90">
                                  {(category.fineAmount ?? 0).toLocaleString('vi-VN')}
                                  <span className="text-[10px] opacity-70 ml-0.5">đ</span>
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1.5 self-start">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 rounded-xl bg-muted/20 hover:bg-primary/10 hover:text-primary transition-colors shrink-0" 
                              onClick={() => {
                                setEditingCategoryId(category.id);
                                setCurrentEditingValues({
                                  name: category.name,
                                  severity: category.severity,
                                  calculationType: category.calculationType || 'fixed',
                                  fineAmount: category.fineAmount || 0,
                                  finePerUnit: category.finePerUnit || 0,
                                  unitLabel: category.unitLabel || 'phút',
                                });
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            
                            <AlertDialog dialogTag="alert-dialog" parentDialogTag="violation-category-management-dialog" variant="destructive">
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white transition-all shrink-0">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogIcon icon={Trash2} />
                                  <div className="space-y-2 text-center sm:text-left">
                                    <AlertDialogTitle>Xóa "{category.name}"?</AlertDialogTitle>
                                    <AlertDialogDescription>Hành động này không thể được hoàn tác. Tất cả cài đặt cho loại vi phạm này sẽ bị mất.</AlertDialogDescription>
                                  </div>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Hủy</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteCategory(category.id)} isLoading={deletingCategoryId === category.id} disabled={deletingCategoryId === category.id}>Xác nhận xóa</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 bg-muted/10 rounded-[2.5rem] border border-dashed border-muted-foreground/20">
                    <LayoutGrid className="h-10 w-10 text-muted-foreground/20 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground italic">Chưa có loại vi phạm nào được tạo.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
