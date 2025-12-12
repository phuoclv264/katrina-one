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
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, Edit, Loader2, Check, Save, ShieldCheck, Repeat, ArrowUp, ArrowDown } from 'lucide-react';
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
} from "@/components/ui/alert-dialog";
import { v4 as uuidv4 } from 'uuid';
import { cn, normalizeSearchString } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

function RuleEditor({ rule, onUpdate, onDelete, isEditing, onMove, canMoveUp, canMoveDown }: { rule: FineRule, onUpdate: (updatedRule: FineRule) => void, onDelete: () => void, isEditing: boolean, onMove: (direction: 'up' | 'down') => void, canMoveUp: boolean, canMoveDown: boolean }) {
    if (!isEditing) {
        let conditionText = '';
        if (rule.condition === 'repeat_in_month') {
            conditionText = `Lặp lại từ lần thứ ${rule.threshold} trong tháng`;
        } else if (rule.condition === 'is_flagged') {
            conditionText = `Bị gắn cờ đỏ`;
        }

        let actionText = '';
        if (rule.action === 'multiply') {
            actionText = `nhân tiền phạt với ${rule.value}`;
        } else {
            actionText = `cộng thêm ${rule.value.toLocaleString('vi-VN')}đ`;
        }

        let severityActionText = '';
        if (rule.severityAction === 'increase') {
            severityActionText = ' và gia tăng mức độ vi phạm.';
        } else if (rule.severityAction === 'set_to_high') {
             severityActionText = ' và chuyển sang vi phạm nghiêm trọng.';
        } else {
            severityActionText = '.';
        }

        return (
            <div className="p-3 border rounded-md bg-blue-500/5 text-sm flex justify-between items-center">
                <span><span className="font-semibold">Nếu một vi phạm</span> {conditionText} <span className="font-semibold">thì</span> {actionText}{severityActionText}</span>
            </div>
        );
    }
    
    return (
        <div className="p-3 border rounded-md space-y-3 bg-blue-500/5">
            <div className="flex justify-between items-start">
                 <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMove('up')} disabled={!canMoveUp}><ArrowUp className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMove('down')} disabled={!canMoveDown}><ArrowDown className="h-4 w-4"/></Button>
                    <p className="font-semibold text-sm">Nếu một vi phạm....</p>
                </div>
                 <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive"/></Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                    <Label className="text-xs">Điều kiện</Label>
                    <Select value={rule.condition} onValueChange={(v) => onUpdate({ ...rule, condition: v as FineRule['condition'] })}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="repeat_in_month">Lặp lại trong tháng</SelectItem>
                            <SelectItem value="is_flagged">Bị gắn cờ</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 {rule.condition === 'repeat_in_month' && (
                    <div className="space-y-1">
                        <Label className="text-xs">Ngưỡng (Từ lần thứ...)</Label>
                        <Input type="number" value={rule.threshold} onChange={(e) => onUpdate({...rule, threshold: Number(e.target.value)})} />
                    </div>
                 )}
            </div>
             <p className="font-semibold text-sm">Thì...</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 <div className="space-y-1">
                    <Label className="text-xs">Hành động</Label>
                    <Select value={rule.action} onValueChange={(v) => onUpdate({ ...rule, action: v as FineRule['action'] })}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="multiply">Nhân tiền phạt</SelectItem>
                            <SelectItem value="add">Cộng thêm tiền phạt</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div className="space-y-1">
                    <Label className="text-xs">Giá trị</Label>
                    <Input type="number" value={rule.value} onChange={(e) => onUpdate({...rule, value: Number(e.target.value)})} />
                </div>
            </div>
             <div className="space-y-1">
                <Label className="text-xs">Hành động phụ</Label>
                <Select
                    value={rule.severityAction || 'none'}
                    onValueChange={(v) => onUpdate({ ...rule, severityAction: v === 'none' ? null : (v as FineRule['severityAction']) })}
                >
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">Không thực hiện</SelectItem>
                        <SelectItem value="increase">Gia tăng mức độ vi phạm</SelectItem>
                        <SelectItem value="set_to_high">Chuyển sang vi phạm nghiêm trọng</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    )
}


export default function ViolationCategoryManagementDialog({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [categoryData, setCategoryData] = useState<ViolationCategoryData>({ list: [], generalRules: [], generalNote: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [currentEditingValues, setCurrentEditingValues] = useState<Omit<ViolationCategory, 'id'>>({ name: '', severity: 'low', calculationType: 'fixed', fineAmount: 0, finePerUnit: 0, unitLabel: 'phút' });
  const [isEditingGeneralRules, setIsEditingGeneralRules] = useState(false);
  const [tempGeneralRules, setTempGeneralRules] = useState<FineRule[]>([]);
  
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
        setCurrentEditingValues(prev => ({...prev, [field]: value}));
    };

  const handleDeleteCategory = async (categoryId: string) => {
    const newList = categoryData.list.filter(c => c.id !== categoryId);
    await handleSave({ list: newList });
    toast.success('Đã xóa loại vi phạm.');
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
      case 'high': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700';
      case 'medium': return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700';
      case 'low':
      default:
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700';
    }
  };
  

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl bg-white dark:bg-card">
        <DialogHeader>
          <DialogTitle>Quản lý Loại Vi phạm</DialogTitle>
          <DialogDescription>
            Thêm, sửa, hoặc xóa các danh mục vi phạm và mức phạt tương ứng.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] -mx-6 px-6">
        <div className="py-4 space-y-4">
          <div className="pt-4">
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold">Quy tắc phạt chung</h4>
                {!isEditingGeneralRules ? (
                    <Button variant="outline" size="sm" onClick={() => setIsEditingGeneralRules(true)}>
                        <Edit className="mr-2 h-4 w-4"/> Chỉnh sửa
                    </Button>
                ) : (
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={handleCancelGeneralRulesEdit}>Hủy</Button>
                        <Button size="sm" onClick={handleSaveGeneralRules}><Save className="mr-2 h-4 w-4"/>Lưu quy tắc</Button>
                    </div>
                )}
            </div>
            <div className="space-y-3">
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
                 <Button variant="outline" size="sm" className="w-full" onClick={handleAddGeneralRule}>
                    <Plus className="mr-2 h-4 w-4" /> Thêm quy tắc chung
                </Button>
              )}
            </div>
          </div>
          <div className="flex gap-2 pt-4 border-t">
            <Input
              placeholder="Tên loại vi phạm mới..."
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddNewCategory()}
            />
            <Button onClick={handleAddNewCategory}><Plus className="mr-2 h-4 w-4" /> Thêm</Button>
          </div>
          
            <div className="space-y-2">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : categoryData.list.length > 0 ? (
                categoryData.list.map(category => (
                  <div
                    key={category.id}
                    ref={(el) => {itemRefs.current.set(category.id, el)}}
                    className={cn(
                      "p-3 space-y-3 border rounded-lg",
                       editingCategoryId === category.id ? "bg-muted border-primary" : "bg-card"
                    )}
                  >
                    {editingCategoryId === category.id ? (
                      // EDITING VIEW
                      <div className="w-full space-y-4">
                         <div className="space-y-4">
                            <Input
                                value={currentEditingValues.name}
                                onChange={(e) => handleEditingValueChange('name', e.target.value)}
                                placeholder="Tên vi phạm"
                            />
                            <div className="space-y-2">
                                <Label className="text-xs">Mức độ</Label>
                                <Select value={currentEditingValues.severity} onValueChange={(val) => handleEditingValueChange('severity', val)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem key="low" value="low">Nhẹ</SelectItem>
                                        <SelectItem key="medium" value="medium">Trung bình</SelectItem>
                                        <SelectItem key="high" value="high">Nghiêm trọng</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                               <Label className="text-xs">Kiểu tính phạt</Label>
                                <RadioGroup 
                                  value={currentEditingValues.calculationType} 
                                  onValueChange={(val) => handleEditingValueChange('calculationType', val)}
                                  className="flex gap-4"
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="fixed" id={`calc-fixed-${category.id}`} />
                                        <Label htmlFor={`calc-fixed-${category.id}`}>Cố định</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="perUnit" id={`calc-unit-${category.id}`} />
                                        <Label htmlFor={`calc-unit-${category.id}`}>Theo đơn vị</Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            {currentEditingValues.calculationType === 'perUnit' ? (
                                <div className="grid grid-cols-2 gap-4">
                                     <div className="space-y-2">
                                        <Label className="text-xs">Tiền phạt/đơn vị</Label>
                                        <Input type="number" value={currentEditingValues.finePerUnit ?? 0} onChange={(e) => handleEditingValueChange('finePerUnit', parseInt(e.target.value, 10) || 0)} onFocus={(e) => e.target.select()} />
                                    </div>
                                     <div className="space-y-2">
                                        <Label className="text-xs">Tên đơn vị</Label>
                                        <Input value={currentEditingValues.unitLabel ?? 'phút'} onChange={(e) => handleEditingValueChange('unitLabel', e.target.value)} />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Label className="text-xs">Mức phạt (VNĐ)</Label>
                                    <Input type="number" value={currentEditingValues.fineAmount} onChange={(e) => handleEditingValueChange('fineAmount', parseInt(e.target.value, 10) || 0)} onFocus={(e) => e.target.select()} />
                                </div>
                            )}

                         </div>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={handleCancelEdit}>Hủy</Button>
                          <Button size="sm" onClick={handleSaveCategory}><Check className="mr-2 h-4 w-4"/>Lưu</Button>
                        </div>
                      </div>
                    ) : (
                      // DISPLAY VIEW
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <p className="font-semibold">{category.name}</p>
                          <div className="flex items-center gap-2 text-sm mt-1">
                            <Badge className={getSeverityBadgeClass(category.severity)}>{category.severity === 'low' ? 'Nhẹ' : category.severity === 'medium' ? 'TB' : 'Nặng'}</Badge>
                            {category.calculationType === 'perUnit' ? (
                                <span className="text-muted-foreground">{(category.finePerUnit ?? 0).toLocaleString('vi-VN')}đ / {category.unitLabel || 'đơn vị'}</span>
                            ) : (
                                <span className="text-muted-foreground">{(category.fineAmount ?? 0).toLocaleString('vi-VN')}đ</span>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { 
                            setEditingCategoryId(category.id); 
                            setCurrentEditingValues({ 
                                name: category.name, 
                                severity: category.severity, 
                                calculationType: category.calculationType || 'fixed', 
                                fineAmount: category.fineAmount || 0,
                                finePerUnit: category.finePerUnit || 0,
                                unitLabel: category.unitLabel || 'phút',
                            }); 
                        }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Xóa "{category.name}"?</AlertDialogTitle>
                              <AlertDialogDescription>Hành động này không thể được hoàn tác.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Hủy</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteCategory(category.id)}>Xóa</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-center text-sm text-muted-foreground py-4">Chưa có loại vi phạm nào.</p>
              )}
            </div>
          
        </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
