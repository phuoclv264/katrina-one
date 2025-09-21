
'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { dataStore } from '@/lib/data-store';
import type { InventoryItem, ParsedInventoryItem, UpdateInventoryItemsOutput } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Package, ArrowUp, ArrowDown, Wand2, Loader2, FileText, Image as ImageIcon, CheckCircle, AlertTriangle, ChevronsDownUp, Shuffle, Check, Sparkles, FileEdit, Download, Pencil, History, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { generateInventoryList } from '@/ai/flows/generate-inventory-list';
import { updateInventoryItems } from '@/ai/flows/update-inventory-items';
import { sortTasks } from '@/ai/flows/sort-tasks';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { diffChars } from 'diff';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SupplierCombobox } from '@/components/supplier-combobox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import isEqual from 'lodash.isequal';
import { ScrollArea } from '@/components/ui/scroll-area';


function InventoryTools({
    inventoryList,
    onItemsGenerated,
    onItemsUpdated,
}: {
    inventoryList: InventoryItem[],
    onItemsGenerated: (items: InventoryItem[]) => void,
    onItemsUpdated: (updatedItems: InventoryItem[]) => void,
}) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeTab, setActiveTab] = useState('add');
    
    // States for "Add with AI"
    const [textInput, setTextInput] = useState('');
    const [imageInput, setImageInput] = useState<string | null>(null);
    const [previewNewItems, setPreviewNewItems] = useState<InventoryItem[]>([]);
    const [previewExistingItems, setPreviewExistingItems] = useState<ParsedInventoryItem[]>([]);
    const [showAddPreview, setShowAddPreview] = useState(false);
    
    // States for "Bulk Edit"
    const [bulkEditTab, setBulkEditTab] = useState('manual');
    const [bulkEditText, setBulkEditText] = useState(''); // For manual pasting
    const [bulkEditAiInput, setBulkEditAiInput] = useState(''); // For AI instruction
    const [parsedManualItems, setParsedManualItems] = useState<InventoryItem[] | null>(null);
    const [showUpdatePreview, setShowUpdatePreview] = useState(false);
    const [updatePreview, setUpdatePreview] = useState<{ oldList: InventoryItem[], newList: InventoryItem[] }>({ oldList: [], newList: [] });

    // States for "Sort with AI"
    const [sortTargetCategory, setSortTargetCategory] = useState('');
    const [sortInstruction, setSortInstruction] = useState('');
    const [showSortPreview, setShowSortPreview] = useState(false);
    const [sortPreviewData, setSortPreviewData] = useState<{ oldOrder: string[], newOrder: string[] }>({ oldOrder: [], newOrder: [] });
    

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => { setImageInput(reader.result as string); };
            reader.readAsDataURL(file);
        }
    };

    const resetAddState = () => {
        setTextInput('');
        setImageInput(null);
        const fileInput = document.getElementById('image-upload-add') as HTMLInputElement;
        if(fileInput) fileInput.value = '';
    };

    const handleGenerateAdd = async (source: 'text' | 'image') => {
        setIsGenerating(true);
        try {
            const input = source === 'text' ? { source, inputText: textInput } : { source, imageDataUri: imageInput! };
            if ((source === 'text' && !textInput.trim()) || (source === 'image' && !imageInput)) {
                toast.error("Vui lòng cung cấp đầu vào."); return;
            }
            toast.loading("AI đang xử lý...");
            const result = await generateInventoryList(input);
            if (!result || !result.items) throw new Error("AI không trả về kết quả hợp lệ.");
            const existingNames = new Set(inventoryList.map(item => item.name.trim().toLowerCase()));
            const newItems: InventoryItem[] = [];
            const existingItems: ParsedInventoryItem[] = [];
            result.items.forEach(item => {
                if (existingNames.has(item.name.trim().toLowerCase())) {
                    existingItems.push(item);
                } else {
                    newItems.push({
                         ...item, id: `item-${Date.now()}-${Math.random()}`,
                        shortName: item.shortName || item.name.split(' ').slice(0,2).join(' '),
                        orderUnit: item.orderUnit || item.unit, conversionRate: item.conversionRate || 1,
                        unitPrice: 0, stock: 0, isImportant: item.isImportant ?? false,
                        requiresPhoto: item.requiresPhoto ?? false, dataType: item.dataType || 'number',
                        priceHistory: [], stockHistory: [],
                    });
                }
            });
            setPreviewNewItems(newItems);
            setPreviewExistingItems(existingItems);
            setShowAddPreview(true);
        } catch (error) {
            console.error("Failed to generate inventory list:", error);
            toast.error("Không thể tạo danh sách từ đầu vào.");
        } finally {
            setIsGenerating(false);
            toast.dismiss();
        }
    };

    const handleConfirmAdd = () => {
        onItemsGenerated(previewNewItems);
        toast.success(`Đã thêm ${previewNewItems.length} mặt hàng mới.`);
        resetAddState();
        setShowAddPreview(false);
    };

     const handleBulkUpdateParse = () => {
        if (!bulkEditText.trim()) {
            toast.error("Vui lòng dán dữ liệu vào ô.");
            return;
        }

        const lines = bulkEditText.trim().split('\n');
        const dataLines = lines.slice(1);
        let changesCount = 0;
        
        const updatedList: InventoryItem[] = JSON.parse(JSON.stringify(inventoryList));

        dataLines.forEach(line => {
            const parts = line.split(' | ').map(p => p.trim());
            const [
                name, shortName, category, supplier, unit, orderUnit,
                conversionRateStr, minStockStr, orderSuggestion,
                requiresPhotoStr, isImportantStr
            ] = parts;

            if (!name) return;

            const itemIndex = updatedList.findIndex(item => item.name.trim().toLowerCase() === name.toLowerCase());
            
            if (itemIndex > -1) {
                const itemToUpdate = updatedList[itemIndex];
                const originalItem = JSON.parse(JSON.stringify(itemToUpdate));

                itemToUpdate.name = name || itemToUpdate.name;
                itemToUpdate.shortName = shortName || itemToUpdate.shortName;
                itemToUpdate.category = category || itemToUpdate.category;
                itemToUpdate.supplier = supplier || itemToUpdate.supplier;
                itemToUpdate.unit = unit || itemToUpdate.unit;
                itemToUpdate.orderUnit = orderUnit || itemToUpdate.orderUnit;
                itemToUpdate.conversionRate = Number(conversionRateStr) || itemToUpdate.conversionRate;
                itemToUpdate.minStock = Number(minStockStr) || itemToUpdate.minStock;
                itemToUpdate.orderSuggestion = orderSuggestion || itemToUpdate.orderSuggestion;
                itemToUpdate.requiresPhoto = requiresPhotoStr ? requiresPhotoStr.toUpperCase() === 'CÓ' : itemToUpdate.requiresPhoto;
                itemToUpdate.isImportant = isImportantStr ? isImportantStr.toUpperCase() === 'CÓ' : itemToUpdate.isImportant;

                if (!isEqual(originalItem, itemToUpdate)) {
                    changesCount++;
                }
            }
        });

        if (changesCount > 0) {
            setUpdatePreview({ oldList: inventoryList, newList: updatedList });
            setShowUpdatePreview(true);
        } else {
            toast('Không tìm thấy mặt hàng nào khớp hoặc không có thay đổi nào.');
        }
    };


    const handleSaveManualBulkEdit = () => {
        if (!parsedManualItems) return;
        
        const updatedList: InventoryItem[] = JSON.parse(JSON.stringify(inventoryList));
        let changesCount = 0;
        
        parsedManualItems.forEach(parsedItem => {
            const itemIndex = updatedList.findIndex(item => item.id === parsedItem.id);
            if (itemIndex > -1) {
                if (!isEqual(updatedList[itemIndex], parsedItem)) {
                    updatedList[itemIndex] = parsedItem;
                    changesCount++;
                }
            } else { // New item
                updatedList.push({ ...parsedItem, id: `item-${Date.now()}-${Math.random()}` });
                changesCount++;
            }
        });
        
        if (changesCount > 0) {
            onItemsUpdated(updatedList);
            toast.success(`Đã cập nhật ${changesCount} mặt hàng.`);
        } else {
            toast('Không có thay đổi nào được ghi nhận.');
        }
        setParsedManualItems(null);
        setBulkEditText('');
    };

    const handleGenerateAiBulkEdit = async () => {
        if (!bulkEditAiInput.trim()) {
            toast.error("Vui lòng nhập yêu cầu chỉnh sửa.");
            return;
        }
        setIsGenerating(true);
        toast.loading("AI đang phân tích yêu cầu...");
        try {
            const result: UpdateInventoryItemsOutput = await updateInventoryItems({
                items: inventoryList,
                instruction: bulkEditAiInput
            });

            if (!result || !result.items || result.items.length !== inventoryList.length) {
                throw new Error("AI không trả về danh sách hợp lệ.");
            }
            setUpdatePreview({ oldList: inventoryList, newList: result.items });
            setShowUpdatePreview(true);
        } catch (error) {
            console.error("Failed to bulk update with AI:", error);
            toast.error("Không thể thực hiện yêu cầu. Vui lòng thử lại.");
        } finally {
            setIsGenerating(false);
            toast.dismiss();
        }
    };
    
    const handleConfirmUpdate = () => {
        onItemsUpdated(updatePreview.newList);
        toast.success("Đã cập nhật danh sách hàng tồn kho.");
        setShowUpdatePreview(false);
    };
    
    const handleGenerateSort = async () => {
        if (!sortTargetCategory) { toast.error("Vui lòng chọn một nhóm để sắp xếp."); return; }
        if (!sortInstruction.trim()) { toast.error("Vui lòng nhập yêu cầu sắp xếp."); return; }
        
        const itemsToSort = inventoryList.filter(item => item.category === sortTargetCategory);
        if (itemsToSort.length < 2) { toast("Nhóm này có ít hơn 2 mặt hàng.", { icon: 'ℹ️' }); return; }

        setIsGenerating(true);
        toast.loading("AI đang sắp xếp...");
        try {
            const currentTasks = itemsToSort.map(t => t.name);
            const result = await sortTasks({
                context: `Inventory items in category: ${sortTargetCategory}`,
                tasks: currentTasks,
                userInstruction: sortInstruction,
            });
            if (!result || !result.sortedTasks || result.sortedTasks.length !== currentTasks.length) {
                throw new Error("AI did not return a valid sorted list.");
            }
            setSortPreviewData({ oldOrder: currentTasks, newOrder: result.sortedTasks });
            setShowSortPreview(true);
        } catch(error) {
            console.error("Failed to sort tasks:", error);
            toast.error("Không thể sắp xếp. Vui lòng thử lại.");
        } finally {
            setIsGenerating(false);
            toast.dismiss();
        }
    };

    const handleConfirmSort = () => {
        const categoryToSort = sortTargetCategory;
        const sortedNames = sortPreviewData.newOrder;
        
        const itemsInCategory = inventoryList.filter(item => item.category === categoryToSort);
        const otherItems = inventoryList.filter(item => item.category !== categoryToSort);
        
        const itemMap = new Map(itemsInCategory.map(item => [item.name, item]));
        const sortedItems = sortedNames.map(name => itemMap.get(name)).filter(Boolean) as InventoryItem[];

        if (sortedItems.length === itemsInCategory.length) {
            const finalSortedList = [...otherItems, ...sortedItems];
            onItemsUpdated(finalSortedList);
            toast.success(`Đã sắp xếp lại nhóm "${categoryToSort}".`);
        } else {
            toast.error("Không thể khớp các mặt hàng đã sắp xếp. Thay đổi đã bị hủy.");
        }
        setShowSortPreview(false);
    };

    const renderDiff = (oldText: string, newText: string) => {
        if (oldText === newText) return newText;
        const differences = diffChars(oldText, newText);
        return differences.map((part, index) => {
            const color = part.added ? 'bg-green-200 dark:bg-green-900/50' : part.removed ? 'line-through bg-red-200 dark:bg-red-900/50' : 'bg-transparent';
            return <span key={index} className={color}>{part.value}</span>;
        });
    };
    
    const renderBooleanDiff = (oldValue: boolean | undefined, newValue: boolean | undefined) => {
        const oldText = oldValue ? 'CÓ' : 'KHÔNG';
        const newText = newValue ? 'CÓ' : 'KHÔNG';
        if (oldValue === newValue) return newText;
        return <span className="bg-green-200 dark:bg-green-900/50">{newText}</span>;
    }
    
    const uniqueCategories = [...new Set(inventoryList.map(item => item.category))].sort();

    return (
        <>
            <Card className="rounded-xl shadow-sm border bg-white dark:bg-card">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl"><Wand2 /> Công cụ Kho</CardTitle>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="add"><Plus className="mr-2 h-4 w-4"/>Thêm bằng AI</TabsTrigger>
                            <TabsTrigger value="bulk-edit"><FileEdit className="mr-2 h-4 w-4"/>Sửa hàng loạt</TabsTrigger>
                            <TabsTrigger value="sort"><Sparkles className="mr-2 h-4 w-4"/>Sắp xếp AI</TabsTrigger>
                        </TabsList>
                        
                        {/* ADD WITH AI TAB */}
                        <TabsContent value="add" className="mt-4 space-y-4">
                            <Tabs defaultValue="text">
                                <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="text"><FileText className="mr-2 h-4 w-4"/>Dán văn bản</TabsTrigger><TabsTrigger value="image"><ImageIcon className="mr-2 h-4 w-4"/>Tải ảnh lên</TabsTrigger></TabsList>
                                <TabsContent value="text" className="mt-4 space-y-4">
                                    <Textarea placeholder="Dán dữ liệu từ Excel/Google Sheets hoặc dạng text..." rows={6} value={textInput} onChange={(e) => setTextInput(e.target.value)} disabled={isGenerating} />
                                    <Button onClick={() => handleGenerateAdd('text')} disabled={isGenerating || !textInput.trim()} className="h-10 w-full"><Wand2 className="mr-2 h-4 w-4" />Tạo danh sách</Button>
                                </TabsContent>
                                <TabsContent value="image" className="mt-4 space-y-4">
                                    <Input id="image-upload-add" type="file" accept="image/*" onChange={handleFileChange} disabled={isGenerating} />
                                    <Button onClick={() => handleGenerateAdd('image')} disabled={isGenerating || !imageInput} className="h-10 w-full"><Wand2 className="mr-2 h-4 w-4" />Tạo danh sách</Button>
                                </TabsContent>
                            </Tabs>
                        </TabsContent>

                        {/* BULK EDIT TAB */}
                        <TabsContent value="bulk-edit" className="mt-4 space-y-4">
                            <Tabs value={bulkEditTab} onValueChange={setBulkEditTab}>
                                <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="manual">Thủ công</TabsTrigger><TabsTrigger value="ai">Bằng AI</TabsTrigger></TabsList>
                                <TabsContent value="manual" className="mt-4 space-y-4">
                                    <Textarea placeholder="Dán dữ liệu đã xuất (dạng bảng) vào đây để bắt đầu chỉnh sửa hàng loạt." rows={6} value={bulkEditText} onChange={(e) => setBulkEditText(e.target.value)} />
                                    <Button onClick={handleBulkUpdateParse} disabled={!bulkEditText.trim()} className="h-10 w-full">Xem trước & Cập nhật</Button>
                                </TabsContent>
                                <TabsContent value="ai" className="mt-4 space-y-4">
                                    <Textarea placeholder="Nhập yêu cầu chỉnh sửa, ví dụ: 'đặt nhà cung cấp của tất cả siro thành ABC'..." rows={4} value={bulkEditAiInput} onChange={(e) => setBulkEditAiInput(e.target.value)} disabled={isGenerating} />
                                    <Button onClick={handleGenerateAiBulkEdit} disabled={isGenerating || !bulkEditAiInput.trim()} className="h-10 w-full"><FileEdit className="mr-2 h-4 w-4" />Xem trước & Cập nhật</Button>
                                </TabsContent>
                            </Tabs>
                        </TabsContent>

                        {/* SORT WITH AI TAB */}
                        <TabsContent value="sort" className="mt-4 space-y-4">
                            <Textarea placeholder="Nhập yêu cầu sắp xếp, ví dụ: 'ưu tiên các loại siro đào lên đầu'" rows={2} value={sortInstruction} onChange={(e) => setSortInstruction(e.target.value)} disabled={isGenerating} />
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Select onValueChange={setSortTargetCategory} value={sortTargetCategory} disabled={isGenerating}>
                                    <SelectTrigger><SelectValue placeholder="Chọn nhóm để sắp xếp..." /></SelectTrigger>
                                    <SelectContent>{uniqueCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
                                </Select>
                                <Button onClick={handleGenerateSort} disabled={isGenerating || !sortTargetCategory || !sortInstruction.trim()} className="h-10 w-full sm:w-auto"><Sparkles className="mr-2 h-4 w-4" />Sắp xếp</Button>
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* DIALOGS */}
            <AlertDialog open={showAddPreview} onOpenChange={setShowAddPreview}><AlertDialogContent className="max-w-4xl"><AlertDialogHeader><AlertDialogTitle>Xem trước các mặt hàng sẽ được thêm</AlertDialogTitle><AlertDialogDescription>Kiểm tra lại danh sách trước khi thêm vào kho.</AlertDialogDescription></AlertDialogHeader><div className="space-y-6 max-h-[60vh] overflow-y-auto p-2">{previewNewItems.length > 0 && <div className="space-y-4"><h3 className="text-base font-semibold flex items-center gap-2"><CheckCircle className="text-green-500"/> Mặt hàng mới</h3><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Tên</TableHead><TableHead>NCC</TableHead><TableHead>Đơn vị</TableHead></TableRow></TableHeader><TableBody>{previewNewItems.map((item) => (<TableRow key={item.id}><TableCell>{item.name}</TableCell><TableCell>{item.supplier}</TableCell><TableCell>{item.unit}</TableCell></TableRow>))}</TableBody></Table></div></div>}{previewExistingItems.length > 0 && <div className="space-y-4"><h3 className="text-base font-semibold flex items-center gap-2"><AlertTriangle className="text-yellow-500"/> Mặt hàng đã có (sẽ bỏ qua)</h3><Table><TableHeader><TableRow><TableHead>Tên</TableHead><TableHead>NCC</TableHead></TableRow></TableHeader><TableBody>{previewExistingItems.map((item, index) => (<TableRow key={index} className="bg-muted/50"><TableCell>{item.name}</TableCell><TableCell>{item.supplier}</TableCell></TableRow>))}</TableBody></Table></div>}</div><AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={handleConfirmAdd} disabled={previewNewItems.length === 0}><Plus className="mr-2 h-4 w-4" />Thêm {previewNewItems.length} mặt hàng mới</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
            <AlertDialog open={showUpdatePreview} onOpenChange={setShowUpdatePreview}><AlertDialogContent className="max-w-6xl"><AlertDialogHeader><AlertDialogTitle>Xem trước các thay đổi</AlertDialogTitle><AlertDialogDescription>Các thay đổi sẽ được highlight màu xanh (thêm) và đỏ (xóa). Vui lòng kiểm tra kỹ trước khi áp dụng.</AlertDialogDescription></AlertDialogHeader><div className="max-h-[60vh] overflow-y-auto p-2 border rounded-md"><Table><TableHeader><TableRow><TableHead>Tên</TableHead><TableHead>Tên VT</TableHead><TableHead>Nhóm</TableHead><TableHead>NCC</TableHead><TableHead>ĐV</TableHead><TableHead>ĐV Đặt</TableHead><TableHead>Tỷ lệ</TableHead><TableHead>Tồn min</TableHead><TableHead>Gợi ý</TableHead><TableHead>Bắt buộc?</TableHead><TableHead>Y/c ảnh?</TableHead></TableRow></TableHeader><TableBody>{updatePreview.newList.map((newItem) => { const oldItem = updatePreview.oldList.find(item => item.id === newItem.id); if (!oldItem) return null; const hasChanged = JSON.stringify(oldItem) !== JSON.stringify(newItem); return (<TableRow key={newItem.id} className={hasChanged ? 'bg-blue-100/30 dark:bg-blue-900/30' : ''}><TableCell>{renderDiff(oldItem.name, newItem.name)}</TableCell><TableCell>{renderDiff(oldItem.shortName || '', newItem.shortName || '')}</TableCell><TableCell>{renderDiff(oldItem.category, newItem.category)}</TableCell><TableCell>{renderDiff(oldItem.supplier, newItem.supplier)}</TableCell><TableCell>{renderDiff(oldItem.unit, newItem.unit)}</TableCell><TableCell>{renderDiff(oldItem.orderUnit || '', newItem.orderUnit || '')}</TableCell><TableCell>{renderDiff(String(oldItem.conversionRate), String(newItem.conversionRate))}</TableCell><TableCell>{renderDiff(String(oldItem.minStock), String(newItem.minStock))}</TableCell><TableCell>{renderDiff(oldItem.orderSuggestion, newItem.orderSuggestion)}</TableCell><TableCell>{renderBooleanDiff(oldItem.isImportant, newItem.isImportant)}</TableCell><TableCell>{renderBooleanDiff(oldItem.requiresPhoto, newItem.requiresPhoto)}</TableCell></TableRow>)})}</TableBody></Table></div><AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={handleConfirmUpdate}>Áp dụng các thay đổi</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
            <Dialog open={showSortPreview} onOpenChange={setShowSortPreview}><DialogContent className="max-w-4xl"><AlertDialogHeader><AlertDialogTitle>Xem trước thứ tự sắp xếp mới</AlertDialogTitle><AlertDialogDescription>AI đề xuất sắp xếp lại nhóm <span className="font-bold">"{sortTargetCategory}"</span> như sau. Bạn có muốn áp dụng?</AlertDialogDescription></AlertDialogHeader><div className="max-h-[60vh] overflow-y-auto p-2 border rounded-md grid grid-cols-2 gap-4"><div><h4 className="font-semibold mb-2 text-center">Thứ tự hiện tại</h4><ul className="space-y-2 text-sm">{sortPreviewData.oldOrder.map((task, index) => (<li key={index} className="p-2 rounded-md bg-muted/50">{index + 1}. {task}</li>))}</ul></div><div><h4 className="font-semibold mb-2 text-center">Thứ tự mới</h4><ul className="space-y-2 text-sm">{sortPreviewData.newOrder.map((task, index) => (<li key={index} className="p-2 rounded-md bg-green-100/50">{index + 1}. {renderDiff(sortPreviewData.oldOrder[index], task)}</li>))}</ul></div></div><AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={handleConfirmSort}>Áp dụng thứ tự mới</AlertDialogAction></AlertDialogFooter></DialogContent></Dialog>
        </>
    )
}

type CategorizedList = {
    category: string;
    items: InventoryItem[];
}[];

export default function InventoryManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [inventoryList, setInventoryList] = useState<InventoryItem[] | null>(null);
  const [suppliers, setSuppliers] = useState<string[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const [isSorting, setIsSorting] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ oldName: string; newName: string } | null>(null);
  const hasInitializedOpenState = useRef(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'Chủ nhà hàng') {
        router.replace('/');
      }
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    let inventorySubscribed = false;
    let suppliersSubscribed = false;

    const checkLoadingDone = () => { if (inventorySubscribed && suppliersSubscribed) { setIsLoading(false); } }

    const unsubSuppliers = dataStore.subscribeToSuppliers((supplierList) => { setSuppliers(supplierList); suppliersSubscribed = true; checkLoadingDone(); });
    const unsubInventory = dataStore.subscribeToInventoryList((items) => { setInventoryList(items); inventorySubscribed = true; checkLoadingDone(); });
    return () => { unsubSuppliers(); unsubInventory(); };
  }, [user]);
  
  const filteredInventoryList = useMemo(() => {
    if (!inventoryList) return [];
    if (!filter) return inventoryList;
    return inventoryList.filter(item => item.name.toLowerCase().includes(filter.toLowerCase()));
  }, [inventoryList, filter]);


  const categorizedList = useMemo((): CategorizedList => {
      if (!filteredInventoryList) return [];
      const categoryOrder: string[] = [];
      const grouped: { [key: string]: InventoryItem[] } = {};
      filteredInventoryList.forEach(item => {
          const category = item.category || 'CHƯA PHÂN LOẠI';
          if (!grouped[category]) {
              grouped[category] = [];
              categoryOrder.push(category);
          }
          grouped[category].push(item);
      });
      return categoryOrder.map(category => ({ category, items: grouped[category] }));
  }, [filteredInventoryList]);

  useEffect(() => {
      if (categorizedList.length > 0 && !hasInitializedOpenState.current) {
          setOpenCategories(categorizedList.map(c => c.category));
          hasInitializedOpenState.current = true;
      }
  }, [categorizedList]);

  const handleUpdateAndSave = useCallback((newList: InventoryItem[]) => {
    setInventoryList(newList);
    dataStore.updateInventoryList(newList);
  }, []);

  const handleUpdate = (id: string, field: keyof InventoryItem, value: string | number | boolean | string[]) => {
    if (!inventoryList) return;
    const newList = inventoryList.map(item => item.id === id ? { ...item, [field]: value } : item);
    handleUpdateAndSave(newList);
  };
  
  const handleSupplierChange = (id: string, newSupplier: string) => {
    if (!inventoryList || !suppliers) return;
    const newList = inventoryList.map(item => item.id === id ? { ...item, supplier: newSupplier } : item);
    handleUpdateAndSave(newList);

    if (!suppliers.includes(newSupplier)) {
        const newSuppliers = [...suppliers, newSupplier].sort();
        setSuppliers(newSuppliers);
        dataStore.updateSuppliers(newSuppliers);
        toast.success(`Đã thêm nhà cung cấp mới: "${newSupplier}"`);
    }
  };

  const handleMoveItem = (indexToMove: number, direction: 'up' | 'down') => {
    if (!inventoryList) return;
    const newList = [...inventoryList];
    const newIndex = direction === 'up' ? indexToMove - 1 : indexToMove + 1;
    if (newIndex < 0 || newIndex >= newList.length) return;
    const itemToMove = newList[indexToMove];
    const itemToSwap = newList[newIndex];
    if (itemToMove.category === itemToSwap.category) {
        [newList[indexToMove], newList[newIndex]] = [newList[newIndex], newList[indexToMove]];
        setInventoryList(newList);
    } else {
        toast.error("Chỉ có thể sắp xếp các mục trong cùng một chủng loại.");
    }
  };

  const handleAddItem = () => {
    if (!inventoryList) return;
    const newItem: InventoryItem = {
      id: `item-${Date.now()}`, name: 'Mặt hàng mới', shortName: 'MHM', category: 'CHƯA PHÂN LOẠI',
      supplier: 'Chưa xác định', unit: 'cái', orderUnit: 'cái', conversionRate: 1, minStock: 1,
      unitPrice: 0, stock: 0, orderSuggestion: '1', dataType: 'number',
      listOptions: ['hết', 'gần hết', 'còn đủ', 'dư xài'], isImportant: false, requiresPhoto: false,
      priceHistory: [], stockHistory: [],
    };
    const newList = [...inventoryList, newItem];
    handleUpdateAndSave(newList);
  };

  const onItemsGenerated = (items: InventoryItem[]) => {
      if (inventoryList && suppliers) {
          const newList = [...inventoryList, ...items];
          handleUpdateAndSave(newList);
          const newSuppliers = new Set(suppliers);
          items.forEach(item => newSuppliers.add(item.supplier));
          const sortedNewSuppliers = Array.from(newSuppliers).sort();
          setSuppliers(sortedNewSuppliers);
          dataStore.updateSuppliers(sortedNewSuppliers);
      }
  }

   const onItemsUpdated = (updatedItems: InventoryItem[]) => {
        handleUpdateAndSave(updatedItems);
  };

  const handleDeleteItem = (id: string) => {
    if (!inventoryList) return;
    const newList = inventoryList.filter(item => item.id !== id);
    handleUpdateAndSave(newList);
  };

  const handleMoveCategory = (categoryIndex: number, direction: 'up' | 'down') => {
      if (!inventoryList || !categorizedList) return;
      const newCategoryOrder = [...categorizedList];
      const targetIndex = direction === 'up' ? categoryIndex - 1 : categoryIndex + 1;
      if (targetIndex < 0 || targetIndex >= newCategoryOrder.length) return;
      [newCategoryOrder[categoryIndex], newCategoryOrder[targetIndex]] = [newCategoryOrder[targetIndex], newCategoryOrder[categoryIndex]];
      const newFlatList = newCategoryOrder.flatMap(category => category.items);
      setInventoryList(newFlatList);
  };

  const handleRenameCategory = () => {
    if (!editingCategory || !inventoryList || !editingCategory.newName.trim()) { setEditingCategory(null); return; }
    const { oldName, newName } = editingCategory;
    const newTrimmedName = newName.trim().toUpperCase();
    const categoryExists = categorizedList.some(c => c.category.toUpperCase() === newTrimmedName && c.category.toUpperCase() !== oldName.toUpperCase());
    if (categoryExists) { toast.error(`Nhóm sản phẩm "${newTrimmedName}" đã tồn tại.`); return; }
    const newList = inventoryList.map(item => item.category === oldName ? { ...item, category: newTrimmedName } : item);
    handleUpdateAndSave(newList);
    setEditingCategory(null);
    setOpenCategories(prev => [...prev.filter(c => c !== oldName), newTrimmedName]);
  };

   const handleToggleAll = () => {
    if (!categorizedList) return;
    if (openCategories.length === categorizedList.length) {
      setOpenCategories([]);
    } else {
      setOpenCategories(categorizedList.map(c => c.category));
    }
  };

  const toggleSortMode = () => {
    const newSortState = !isSorting;
    setIsSorting(newSortState);
    if (!newSortState && inventoryList) {
        dataStore.updateInventoryList(inventoryList);
        toast.success("Đã lưu thứ tự mới!");
    }
  };
  
  const handleExport = (type: 'table' | 'text') => {
      if (!inventoryList) return;
      let textToCopy = '';
      if (type === 'table') {
          const headers = ['Tên mặt hàng', 'Tên viết tắt', 'Nhóm', 'Nhà cung cấp', 'Đơn vị', 'ĐV Đặt hàng', 'Tỷ lệ quy đổi', 'Tồn tối thiểu', 'Gợi ý đặt hàng', 'Yêu cầu ảnh', 'Bắt buộc nhập'];
          const rows = inventoryList.map(item => 
              [item.name, item.shortName, item.category, item.supplier, item.unit, item.orderUnit, item.conversionRate, item.minStock, item.orderSuggestion, item.requiresPhoto ? 'CÓ' : 'KHÔNG', item.isImportant ? 'CÓ' : 'KHÔNG'].join(' | ')
          );
          textToCopy = [headers.join(' | '), ...rows].join('\n');
      } else {
            textToCopy = inventoryList.map(item => 
              [item.name, item.shortName, item.category, item.supplier, item.unit, item.orderUnit, item.conversionRate, item.minStock, item.orderSuggestion].join(' | ')
          ).join('\n');
      }
      navigator.clipboard.writeText(textToCopy).then(() => {
          toast.success("Danh sách đã được sao chép vào bộ nhớ tạm.");
      }).catch(err => {
          toast.error("Không thể sao chép danh sách.");
          console.error("Copy to clipboard failed:", err);
      });
  };

  if (isLoading || authLoading || !inventoryList || !suppliers) {
    return (
      <div className="container mx-auto max-w-7xl p-4 sm:p-6 md:p-8">
        <header className="mb-8">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-5 w-1/2 mt-2" />
        </header>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }
   const areAllCategoriesOpen = categorizedList && categorizedList.length > 0 && openCategories.length === categorizedList.length;

  return (
    <div className="container mx-auto max-w-7xl p-4 sm:p-6 md:p-8">
        <header className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold font-headline flex items-center gap-3"><Package/> Quản lý Hàng tồn kho</h1>
            <p className="text-muted-foreground mt-2">Mọi thay đổi sẽ được lưu tự động. Chế độ sắp xếp sẽ lưu khi bạn nhấn "Lưu thứ tự".</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
            <div className="lg:col-span-1 lg:sticky lg:top-4 order-2 lg:order-1">
                <InventoryTools
                    inventoryList={inventoryList}
                    onItemsGenerated={onItemsGenerated}
                    onItemsUpdated={onItemsUpdated}
                />
            </div>
            <div className="lg:col-span-3 order-1 lg:order-2">
                <Card className="rounded-xl shadow-sm border bg-white dark:bg-card">
                    <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle>Danh sách kho hiện tại</CardTitle>
                            <div className="relative mt-2">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Tìm theo tên mặt hàng..." className="pl-8" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Tìm kiếm mặt hàng" />
                            </div>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                            <Button asChild variant="outline" size="sm" className="h-10 px-3 rounded-md inline-flex items-center gap-2 transition-colors"><Link href="/inventory-history"><History className="mr-2 h-4 w-4" />Lịch sử Kho</Link></Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-10 px-3 rounded-md inline-flex items-center gap-2 transition-colors"><Download className="mr-2 h-4 w-4"/>Xuất dữ liệu</Button></DropdownMenuTrigger>
                                <DropdownMenuContent><DropdownMenuItem onClick={() => handleExport('table')}>Sao chép (dạng bảng)</DropdownMenuItem><DropdownMenuItem onClick={() => handleExport('text')}>Sao chép (dạng text)</DropdownMenuItem></DropdownMenuContent>
                            </DropdownMenu>
                            {isSorting ? (
                                <Button variant="default" size="sm" onClick={toggleSortMode} className="h-10 px-3 rounded-md inline-flex items-center gap-2 transition-colors active:scale-95"><Check className="mr-2 h-4 w-4"/>Lưu thứ tự</Button>
                            ) : (
                                <Button variant="outline" size="sm" onClick={toggleSortMode} className="h-10 px-3 rounded-md inline-flex items-center gap-2 transition-colors"><Shuffle className="mr-2 h-4 w-4"/>Sắp xếp</Button>
                            )}
                            {categorizedList && categorizedList.length > 0 && (<Button variant="outline" onClick={handleToggleAll} size="sm" className="h-10 px-3 rounded-md inline-flex items-center gap-2 transition-colors"><ChevronsDownUp className="mr-2 h-4 w-4"/>{areAllCategoriesOpen ? "Thu gọn" : "Mở rộng"}</Button>)}
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <Accordion type="multiple" value={openCategories} onValueChange={setOpenCategories} className="space-y-4">
                        {categorizedList.map(({category, items}, categoryIndex) => (
                            <AccordionItem value={category} key={category} className="border rounded-lg bg-white dark:bg-card">
                                <div className="flex items-center p-2">
                                    <AccordionTrigger className="text-lg font-semibold flex-1 hover:no-underline p-2" disabled={isSorting}>
                                        {editingCategory?.oldName === category ? (<Input value={editingCategory.newName} onChange={(e) => setEditingCategory({ ...editingCategory, newName: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleRenameCategory()} onBlur={handleRenameCategory} autoFocus className="text-lg font-semibold h-9" onClick={(e) => e.stopPropagation()} />) : (category)}
                                    </AccordionTrigger>
                                    {isSorting ? (
                                        <div className="flex items-center gap-1 pl-4">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleMoveCategory(categoryIndex, 'up')} disabled={categoryIndex === 0}><ArrowUp className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleMoveCategory(categoryIndex, 'down')} disabled={categorizedList.length - 1 === categoryIndex}><ArrowDown className="h-4 w-4" /></Button>
                                        </div>
                                    ) : (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setEditingCategory({ oldName: category, newName: category })}><Pencil className="h-4 w-4" /></Button>
                                    )}
                                </div>
                                <AccordionContent className="border-t">
                                    {!isMobile ? (
                                    <div className="overflow-x-auto -mx-4 px-4">
                                        <Table>
                                            <TableHeader className="sticky top-0 bg-white/95 dark:bg-card/95 backdrop-blur-sm z-10"><TableRow><TableHead className="min-w-[250px] p-3 sm:p-4">Tên</TableHead><TableHead className="min-w-[150px] p-3 sm:p-4">Tên VT</TableHead><TableHead className="min-w-[180px] p-3 sm:p-4">Nhà CC</TableHead><TableHead className="p-3 sm:p-4">Đơn vị</TableHead><TableHead className="p-3 sm:p-4">ĐV Đặt</TableHead><TableHead className="p-3 sm:p-4">Tỷ lệ QĐ</TableHead><TableHead className="p-3 sm:p-4">Tồn min</TableHead><TableHead className="p-3 sm:p-4">Gợi ý</TableHead><TableHead className="text-center p-3 sm:p-4">Bắt buộc</TableHead><TableHead className="text-center p-3 sm:p-4">Cần ảnh</TableHead><TableHead className="w-[50px] text-right p-3 sm:p-4">Xóa</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {items.map((item, index) => {
                                                    const globalIndex = inventoryList.findIndex(i => i.id === item.id);
                                                    return (
                                                    <TableRow key={item.id} className="transition-colors hover:bg-muted/50">
                                                        <TableCell className="font-semibold p-3 sm:p-4"><Input defaultValue={item.name} onBlur={e => handleUpdate(item.id, 'name', e.target.value)} disabled={isSorting} /></TableCell>
                                                        <TableCell className="p-3 sm:p-4"><Input defaultValue={item.shortName} onBlur={e => handleUpdate(item.id, 'shortName', e.target.value)} disabled={isSorting} /></TableCell>
                                                        <TableCell className="p-3 sm:p-4"><SupplierCombobox suppliers={suppliers || []} value={item.supplier} onChange={(s) => handleSupplierChange(item.id, s)} disabled={isSorting} /></TableCell>
                                                        <TableCell className="p-3 sm:p-4"><Input defaultValue={item.unit} onBlur={e => handleUpdate(item.id, 'unit', e.target.value)} disabled={isSorting} /></TableCell>
                                                        <TableCell className="p-3 sm:p-4"><Input defaultValue={item.orderUnit} onBlur={e => handleUpdate(item.id, 'orderUnit', e.target.value)} disabled={isSorting} /></TableCell>
                                                        <TableCell className="p-3 sm:p-4">{item.orderUnit !== item.unit ? (<Input type="number" defaultValue={item.conversionRate} onBlur={e => handleUpdate(item.id, 'conversionRate', Number(e.target.value) || 1)} disabled={isSorting} />) : (<div className="flex items-center justify-center h-10 text-muted-foreground">1</div>)}</TableCell>
                                                        <TableCell className="p-3 sm:p-4"><Input type="number" defaultValue={item.minStock} onBlur={e => handleUpdate(item.id, 'minStock', Number(e.target.value) || 0)} disabled={isSorting}/></TableCell>
                                                        <TableCell className="p-3 sm:p-4"><Input defaultValue={item.orderSuggestion} onBlur={e => handleUpdate(item.id, 'orderSuggestion', e.target.value)} disabled={isSorting}/></TableCell>
                                                        <TableCell className="text-center p-3 sm:p-4"><Switch checked={!!item.isImportant} onCheckedChange={c => handleUpdate(item.id, 'isImportant', c)} disabled={isSorting}/></TableCell>
                                                        <TableCell className="text-center p-3 sm:p-4"><Switch checked={!!item.requiresPhoto} onCheckedChange={c => handleUpdate(item.id, 'requiresPhoto', c)} disabled={isSorting}/></TableCell>
                                                        <TableCell className="text-right p-3 sm:p-4">{isSorting ? (<div className="flex flex-col"><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMoveItem(globalIndex, 'up')} disabled={index === 0}><ArrowUp className="h-3 w-3" /></Button><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMoveItem(globalIndex, 'down')} disabled={index === items.length - 1}><ArrowDown className="h-3 w-3" /></Button></div>) : (<Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteItem(item.id)}><Trash2 className="h-4 w-4" /></Button>)}</TableCell>
                                                    </TableRow>
                                                )})}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    ) : (
                                        <div className="space-y-3 p-2">
                                            {items.map(item => (
                                                <Card key={item.id} className="bg-white dark:bg-card rounded-lg shadow-sm p-4 flex flex-col gap-2">
                                                    <div className="flex justify-between items-start"><p className="font-semibold">{item.name}</p><Button variant="ghost" size="icon" className="text-destructive h-8 w-8 -mt-2 -mr-2" onClick={() => handleDeleteItem(item.id)}><Trash2 className="h-4 w-4" /></Button></div>
                                                    <p className="text-xs text-muted-foreground">{item.supplier}</p>
                                                    <div className="grid grid-cols-3 gap-2 text-center text-sm pt-2 border-t"><div><Label>Đơn vị</Label><p className="font-medium">{item.unit}</p></div><div><Label>Tồn min</Label><p className="font-medium">{item.minStock}</p></div><div><Label>Gợi ý</Label><p className="font-medium">{item.orderSuggestion}</p></div></div>
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                        </Accordion>
                        <div className="mt-6 flex justify-start items-center">
                            <Button variant="outline" onClick={handleAddItem} className="h-10 px-3 rounded-md inline-flex items-center gap-2 transition-colors"><Plus className="mr-2 h-4 w-4" />Thêm mặt hàng mới</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}
