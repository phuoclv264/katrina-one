
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import isEqual from 'lodash.isequal';


type InventoryToolsProps = {
    inventoryList: InventoryItem[];
    onItemsGenerated: (items: InventoryItem[]) => void;
    onItemsUpdated: (updatedItems: InventoryItem[]) => void;
};

export default function InventoryTools({
    inventoryList,
    onItemsGenerated,
    onItemsUpdated,
}: InventoryToolsProps) {
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
        
        // Check if the first line is a header and skip it if so
        const hasHeader = lines[0].includes("Tên mặt hàng");
        const dataLines = hasHeader ? lines.slice(1) : lines;
    
        let changesCount = 0;
        const updatedList: InventoryItem[] = JSON.parse(JSON.stringify(inventoryList));
    
        dataLines.forEach(line => {
            if (!line.trim()) return; // Skip empty lines
    
            const parts = line.split('|').map(p => p.trim());
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
