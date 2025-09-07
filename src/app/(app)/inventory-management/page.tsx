
'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { dataStore } from '@/lib/data-store';
import type { InventoryItem, ParsedInventoryItem, UpdateInventoryItemsOutput } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Package, ArrowUp, ArrowDown, Wand2, Loader2, FileText, Image as ImageIcon, CheckCircle, AlertTriangle, ChevronsDownUp, Shuffle, Check, Sparkles, FileEdit, Download, Star, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { generateInventoryList } from '@/ai/flows/generate-inventory-list';
import { sortTasks } from '@/ai/flows/sort-tasks';
import { updateInventoryItems } from '@/ai/flows/update-inventory-items';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { diffChars } from 'diff';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SupplierCombobox } from '@/components/supplier-combobox';
import { Switch } from '@/components/ui/switch';


function AiAssistant({
    inventoryList,
    onItemsGenerated,
    onItemsSorted,
    onItemsUpdated,
}: {
    inventoryList: InventoryItem[],
    onItemsGenerated: (items: InventoryItem[]) => void,
    onItemsSorted: (sortedNames: string[]) => void,
    onItemsUpdated: (updatedItems: InventoryItem[]) => void,
}) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [textInput, setTextInput] = useState('');
    const [imageInput, setImageInput] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('add');
    const { toast } = useToast();
    const [sortInstruction, setSortInstruction] = useState('');
    const [updateInstruction, setUpdateInstruction] = useState('');


    const [previewNewItems, setPreviewNewItems] = useState<InventoryItem[]>([]);
    const [previewExistingItems, setPreviewExistingItems] = useState<ParsedInventoryItem[]>([]);
    const [showAddPreview, setShowAddPreview] = useState(false);

    const [showSortPreview, setShowSortPreview] = useState(false);
    const [sortPreview, setSortPreview] = useState<{ oldOrder: string[], newOrder: string[] }>({ oldOrder: [], newOrder: [] });
    
    const [showUpdatePreview, setShowUpdatePreview] = useState(false);
    const [updatePreview, setUpdatePreview] = useState<{ oldList: InventoryItem[], newList: InventoryItem[] }>({ oldList: [], newList: [] });


    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImageInput(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const resetState = () => {
        setTextInput('');
        setImageInput(null);
        const fileInput = document.getElementById('image-upload') as HTMLInputElement;
        if(fileInput) fileInput.value = '';
    }

    const handleGenerateAdd = async (source: 'text' | 'image') => {
        setIsGenerating(true);

        try {
            const input = source === 'text'
                ? { source, inputText: textInput }
                : { source, imageDataUri: imageInput! };

            if ((source === 'text' && !textInput.trim()) || (source === 'image' && !imageInput)) {
                toast({ title: "Lỗi", description: "Vui lòng cung cấp đầu vào.", variant: "destructive" });
                setIsGenerating(false);
                return;
            }

            toast({ title: "AI đang xử lý...", description: "Quá trình này có thể mất một chút thời gian."});

            const result = await generateInventoryList(input);

            if (!result || !result.items) {
                 throw new Error("AI không trả về kết quả hợp lệ.");
            }

            const existingNames = new Set(inventoryList.map(item => item.name.trim().toLowerCase()));
            const generatedNewItems: InventoryItem[] = [];
            const generatedExistingItems: ParsedInventoryItem[] = [];

            result.items.forEach(item => {
                if (existingNames.has(item.name.trim().toLowerCase())) {
                    generatedExistingItems.push(item);
                } else {
                    generatedNewItems.push({
                         ...item,
                        id: `item-${Date.now()}-${Math.random()}`
                    });
                }
            });

            setPreviewNewItems(generatedNewItems);
            setPreviewExistingItems(generatedExistingItems);
            setShowAddPreview(true);

        } catch (error) {
            console.error("Failed to generate inventory list:", error);
            toast({ title: "Lỗi", description: "Không thể tạo danh sách từ đầu vào. Vui lòng thử lại.", variant: "destructive"});
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleConfirmAdd = () => {
        onItemsGenerated(previewNewItems);
        toast({ title: "Hoàn tất!", description: `Đã thêm ${previewNewItems.length} mặt hàng mới.`});
        resetState();
        setShowAddPreview(false);
    }

    const handleEditNewItem = (index: number, field: keyof InventoryItem, value: string | number) => {
        const updatedItems = [...previewNewItems];
        (updatedItems[index] as any)[field] = value;
        setPreviewNewItems(updatedItems);
    }

    const handleDeleteNewItem = (id: string) => {
        const updatedItems = previewNewItems.filter(item => item.id !== id);
        setPreviewNewItems(updatedItems);
    }
    
    const handleGenerateSort = async () => {
        if (inventoryList.length < 2) {
            toast({ title: "Không cần sắp xếp", description: "Cần có ít nhất 2 mặt hàng để sắp xếp.", variant: "default" });
            return;
        }
        if (!sortInstruction.trim()) {
            toast({ title: "Lỗi", description: "Vui lòng nhập yêu cầu sắp xếp.", variant: "destructive" });
            return;
        }

        setIsGenerating(true);
        toast({ title: "AI đang sắp xếp...", description: "Vui lòng đợi một lát. AI sẽ nhóm các mặt hàng theo chủng loại." });

        try {
            const currentItems = inventoryList.map(t => t.name);
            const result = await sortTasks({
                context: `A complete inventory list for a coffee shop. The list needs to be sorted by category (e.g., all 'TOPPING' items together, all 'TRÁI CÂY' items together, etc.).`,
                tasks: currentItems,
                userInstruction: sortInstruction,
            });

            if (!result || !result.sortedTasks || result.sortedTasks.length !== currentItems.length) {
                throw new Error("AI did not return a valid sorted list.");
            }

            setSortPreview({ oldOrder: currentItems, newOrder: result.sortedTasks });
            setShowSortPreview(true);

        } catch(error) {
            console.error("Failed to sort inventory:", error);
            toast({ title: "Lỗi", description: "Không thể sắp xếp. Vui lòng thử lại.", variant: "destructive"});
        } finally {
            setIsGenerating(false);
        }
    }

    const handleConfirmSort = () => {
        onItemsSorted(sortPreview.newOrder);
        toast({ title: "Hoàn tất!", description: `Đã sắp xếp lại danh sách hàng tồn kho.` });
        setShowSortPreview(false);
        setSortInstruction('');
    }

    const handleGenerateUpdate = async () => {
        if (!updateInstruction.trim()) {
            toast({ title: "Lỗi", description: "Vui lòng nhập yêu cầu chỉnh sửa.", variant: "destructive" });
            return;
        }

        setIsGenerating(true);
        toast({ title: "AI đang phân tích yêu cầu...", description: "Vui lòng đợi. AI sẽ xử lý và đưa ra bản xem trước." });

        try {
            const result = await updateInventoryItems({
                items: inventoryList,
                instruction: updateInstruction,
            });

            if (!result || !result.items || result.items.length !== inventoryList.length) {
                throw new Error("AI không trả về một danh sách hợp lệ.");
            }

            setUpdatePreview({ oldList: inventoryList, newList: result.items });
            setShowUpdatePreview(true);

        } catch(error) {
            console.error("Failed to update inventory:", error);
            toast({ title: "Lỗi", description: "Không thể thực hiện chỉnh sửa. Vui lòng thử lại với yêu cầu rõ ràng hơn.", variant: "destructive"});
        } finally {
            setIsGenerating(false);
        }
    };

    const handleConfirmUpdate = () => {
        onItemsUpdated(updatePreview.newList);
        toast({ title: "Hoàn tất!", description: "Đã cập nhật danh sách hàng tồn kho."});
        setShowUpdatePreview(false);
        setUpdateInstruction('');
    };

    const renderDiff = (oldText: string, newText: string) => {
        if (oldText === newText) return newText;
        const differences = diffChars(oldText, newText);
        return differences.map((part, index) => {
            const color = part.added ? 'bg-green-200 dark:bg-green-900/50' : part.removed ? 'line-through bg-red-200 dark:bg-red-900/50' : 'bg-transparent';
            return <span key={index} className={color}>{part.value}</span>;
        });
    };

    return (
        <>
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl"><Wand2 /> Công cụ hỗ trợ AI</CardTitle>
                    <CardDescription>Sử dụng AI để thêm, sắp xếp, hoặc chỉnh sửa hàng loạt các mặt hàng một cách thông minh.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="add"><Plus className="mr-2 h-4 w-4"/>Thêm mới</TabsTrigger>
                            <TabsTrigger value="sort"><Sparkles className="mr-2 h-4 w-4"/>Sắp xếp</TabsTrigger>
                            <TabsTrigger value="edit"><FileEdit className="mr-2 h-4 w-4"/>Chỉnh sửa</TabsTrigger>
                        </TabsList>
                        <TabsContent value="add" className="mt-4 space-y-4">
                             <Tabs defaultValue="text">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="text"><FileText className="mr-2 h-4 w-4"/>Dán văn bản</TabsTrigger>
                                    <TabsTrigger value="image"><ImageIcon className="mr-2 h-4 w-4"/>Tải ảnh lên</TabsTrigger>
                                </TabsList>
                                <TabsContent value="text" className="mt-4 space-y-4">
                                    <Textarea
                                        placeholder="Dán dữ liệu từ Excel/Google Sheets hoặc dạng text theo định dạng: Nhóm-Tên-NCC-Đơn vị-Tồn-Gợi ý đặt hàng"
                                        rows={6}
                                        value={textInput}
                                        onChange={(e) => setTextInput(e.target.value)}
                                        disabled={isGenerating}
                                    />
                                    <Button onClick={() => handleGenerateAdd('text')} disabled={isGenerating || !textInput.trim()}>
                                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                        Tạo danh sách
                                    </Button>
                                </TabsContent>
                                <TabsContent value="image" className="mt-4 space-y-4">
                                    <Input
                                        id="image-upload"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        disabled={isGenerating}
                                    />
                                    <Button onClick={() => handleGenerateAdd('image')} disabled={isGenerating || !imageInput}>
                                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                        Tạo danh sách
                                    </Button>
                                </TabsContent>
                            </Tabs>
                        </TabsContent>
                         <TabsContent value="sort" className="mt-4 space-y-4">
                             <Textarea
                                placeholder="Nhập yêu cầu của bạn, ví dụ: 'nhóm tất cả các loại topping và trái cây lại với nhau'"
                                rows={2}
                                value={sortInstruction}
                                onChange={(e) => setSortInstruction(e.target.value)}
                                disabled={isGenerating}
                            />
                            <Button onClick={handleGenerateSort} disabled={isGenerating || inventoryList.length < 2 || !sortInstruction.trim()}>
                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                Sắp xếp toàn bộ bằng AI
                            </Button>
                        </TabsContent>
                         <TabsContent value="edit" className="mt-4 space-y-4">
                             <Textarea
                                placeholder="Nhập yêu cầu của bạn, ví dụ: 'tăng tồn tối thiểu của tất cả topping lên 2' hoặc 'đổi nhà cung cấp của tất cả siro thành ABC'"
                                rows={3}
                                value={updateInstruction}
                                onChange={(e) => setUpdateInstruction(e.target.value)}
                                disabled={isGenerating}
                            />
                            <Button onClick={handleGenerateUpdate} disabled={isGenerating || !updateInstruction.trim()}>
                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileEdit className="mr-2 h-4 w-4" />}
                                Xem trước & Chỉnh sửa bằng AI
                            </Button>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <AlertDialog open={showAddPreview} onOpenChange={setShowAddPreview}>
                <AlertDialogContent className="max-w-4xl">
                     <AlertDialogHeader>
                        <AlertDialogTitle>Xem trước các mặt hàng sẽ được thêm</AlertDialogTitle>
                        <AlertDialogDescription>
                            AI đã phân tích đầu vào của bạn. Kiểm tra và chỉnh sửa lại danh sách các mặt hàng mới dưới đây trước khi thêm chúng vào kho.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-6 max-h-[60vh] overflow-y-auto p-2">
                        {previewNewItems.length > 0 && (
                             <div className="space-y-4">
                                <h3 className="text-base font-semibold flex items-center gap-2"><CheckCircle className="text-green-500"/> Mặt hàng mới (Có thể chỉnh sửa)</h3>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Tên mặt hàng</TableHead>
                                                <TableHead className="w-40">Nhà cung cấp</TableHead>
                                                <TableHead className="w-28">Đơn vị</TableHead>
                                                <TableHead className="w-32">Tồn tối thiểu</TableHead>
                                                <TableHead className="w-32">Gợi ý đặt</TableHead>
                                                <TableHead className="text-right w-20">Xóa</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {previewNewItems.map((item, index) => (
                                                <TableRow key={item.id}>
                                                    <TableCell><Input value={item.name} onChange={e => handleEditNewItem(index, 'name', e.target.value)} /></TableCell>
                                                    <TableCell><Input value={item.supplier} onChange={e => handleEditNewItem(index, 'supplier', e.target.value)} /></TableCell>
                                                    <TableCell><Input value={item.unit} onChange={e => handleEditNewItem(index, 'unit', e.target.value)} /></TableCell>
                                                    <TableCell><Input type="number" value={item.minStock} onChange={e => handleEditNewItem(index, 'minStock', parseInt(e.target.value) || 0)} /></TableCell>
                                                    <TableCell><Input value={item.orderSuggestion} onChange={e => handleEditNewItem(index, 'orderSuggestion', e.target.value)} /></TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteNewItem(item.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                       {previewExistingItems.length > 0 && (
                             <div className="space-y-4">
                               <h3 className="text-base font-semibold flex items-center gap-2"><AlertTriangle className="text-yellow-500"/> Mặt hàng đã có (sẽ được bỏ qua)</h3>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Tên mặt hàng</TableHead>
                                            <TableHead>Nhà cung cấp</TableHead>
                                            <TableHead>Đơn vị</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {previewExistingItems.map((item, index) => (
                                            <TableRow key={index} className="bg-muted/50">
                                                <TableCell>{item.name}</TableCell>
                                                <TableCell>{item.supplier}</TableCell>
                                                <TableCell>{item.unit}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                        {previewNewItems.length === 0 && previewExistingItems.length === 0 && (
                             <p className="text-sm text-muted-foreground text-center py-8">AI không tìm thấy mặt hàng nào từ đầu vào của bạn.</p>
                        )}
                    </div>
                     <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setShowAddPreview(false)}>Hủy bỏ</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmAdd} disabled={previewNewItems.length === 0}>
                            <Plus className="mr-2 h-4 w-4" />
                            Thêm {previewNewItems.length} mặt hàng mới
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={showSortPreview} onOpenChange={setShowSortPreview}>
                <AlertDialogContent className="max-w-4xl">
                     <AlertDialogHeader>
                        <AlertDialogTitle>Xem trước thứ tự sắp xếp mới</AlertDialogTitle>
                        <AlertDialogDescription>
                            AI đề xuất sắp xếp lại danh sách hàng tồn kho như sau. Bạn có muốn áp dụng thay đổi không?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                     <div className="max-h-[60vh] overflow-y-auto p-2 border rounded-md grid grid-cols-2 gap-4">
                       <div>
                           <h4 className="font-semibold mb-2 text-center">Thứ tự hiện tại</h4>
                           <ul className="space-y-2 text-sm">
                               {sortPreview.oldOrder.map((task, index) => (
                                   <li key={index} className="p-2 rounded-md bg-muted/50 truncate">
                                       {index + 1}. {task}
                                   </li>
                               ))}
                           </ul>
                       </div>
                        <div>
                           <h4 className="font-semibold mb-2 text-center">Thứ tự mới</h4>
                           <ul className="space-y-2 text-sm">
                               {sortPreview.newOrder.map((task, index) => {
                                    const oldIndex = sortPreview.oldOrder.findIndex(t => t === task);
                                    const oldTaskText = oldIndex !== -1 ? sortPreview.oldOrder[oldIndex] : '';
                                    return (
                                       <li key={index} className="p-2 rounded-md bg-green-100/50 truncate">
                                           {index + 1}. {renderDiff(oldTaskText, task)}
                                       </li>
                                    )
                               })}
                           </ul>
                       </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmSort}>Áp dụng thứ tự mới</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

             <AlertDialog open={showUpdatePreview} onOpenChange={setShowUpdatePreview}>
                <AlertDialogContent className="max-w-6xl">
                     <AlertDialogHeader>
                        <AlertDialogTitle>Xem trước các thay đổi</AlertDialogTitle>
                        <AlertDialogDescription>
                           AI đã xử lý yêu cầu của bạn. Các thay đổi sẽ được highlight màu xanh (thêm) và đỏ (xóa). Vui lòng kiểm tra kỹ trước khi áp dụng.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                     <div className="max-h-[60vh] overflow-y-auto p-2 border rounded-md">
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[35%]">Tên mặt hàng</TableHead>
                                    <TableHead className="w-[20%]">Nhà cung cấp</TableHead>
                                    <TableHead>Đơn vị</TableHead>
                                    <TableHead>Tồn tối thiểu</TableHead>
                                    <TableHead>Gợi ý đặt hàng</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {updatePreview.newList.map((newItem, index) => {
                                    const oldItem = updatePreview.oldList.find(item => item.id === newItem.id);
                                    if (!oldItem) return null;
                                    
                                    const hasChanged = JSON.stringify(oldItem) !== JSON.stringify(newItem);

                                    return (
                                        <TableRow key={newItem.id} className={hasChanged ? 'bg-blue-100/30 dark:bg-blue-900/30' : ''}>
                                            <TableCell>{renderDiff(oldItem.name, newItem.name)}</TableCell>
                                            <TableCell>{renderDiff(oldItem.supplier, newItem.supplier)}</TableCell>
                                            <TableCell>{renderDiff(oldItem.unit, newItem.unit)}</TableCell>
                                            <TableCell>{renderDiff(String(oldItem.minStock), String(newItem.minStock))}</TableCell>
                                            <TableCell>{renderDiff(oldItem.orderSuggestion, newItem.orderSuggestion)}</TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                         </Table>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmUpdate}>Áp dụng các thay đổi</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
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
  const { toast } = useToast();
  const [inventoryList, setInventoryList] = useState<InventoryItem[] | null>(null);
  const [suppliers, setSuppliers] = useState<string[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const [isSorting, setIsSorting] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ oldName: string; newName: string } | null>(null);


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

    const checkLoadingDone = () => {
        if (inventorySubscribed && suppliersSubscribed) {
            setIsLoading(false);
        }
    }

    const unsubSuppliers = dataStore.subscribeToSuppliers((supplierList) => {
        setSuppliers(supplierList);
        suppliersSubscribed = true;
        checkLoadingDone();
    });
    const unsubInventory = dataStore.subscribeToInventoryList((items) => {
        setInventoryList(items);
        inventorySubscribed = true;
        checkLoadingDone();
    });
    return () => {
        unsubSuppliers();
        unsubInventory();
    };
  }, [user]);

  const categorizedList = useMemo((): CategorizedList => {
      if (!inventoryList) return [];

      const categoryOrder: string[] = [];
      const grouped: { [key: string]: InventoryItem[] } = {};

      inventoryList.forEach(item => {
          const category = item.category || 'CHƯA PHÂN LOẠI';
          if (!grouped[category]) {
              grouped[category] = [];
              categoryOrder.push(category);
          }
          grouped[category].push(item);
      });

      return categoryOrder.map(category => ({ category, items: grouped[category] }));

  }, [inventoryList]);

  // Set accordion to open all by default
  useEffect(() => {
      if (categorizedList.length > 0 && openCategories.length === 0) {
          setOpenCategories(categorizedList.map(c => c.category));
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorizedList]);

  const handleUpdateAndSave = useCallback((newList: InventoryItem[]) => {
    setInventoryList(newList);
    dataStore.updateInventoryList(newList);
  }, []);


  const handleUpdate = (id: string, field: keyof InventoryItem, value: string | number | boolean) => {
    if (!inventoryList) return;
    const newList = inventoryList.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    );
    handleUpdateAndSave(newList);
  };
  
  const handleSupplierChange = (id: string, newSupplier: string) => {
    if (!inventoryList || !suppliers) return;
    const newList = inventoryList.map(item =>
        item.id === id ? { ...item, supplier: newSupplier } : item
    );
    handleUpdateAndSave(newList);

    if (!suppliers.includes(newSupplier)) {
        const newSuppliers = [...suppliers, newSupplier].sort();
        setSuppliers(newSuppliers);
        dataStore.updateSuppliers(newSuppliers);
        toast({ title: "Đã thêm nhà cung cấp mới!", description: `"${newSupplier}" đã được thêm vào danh sách chung.`});
    }
  };

  const handleMoveItem = (indexToMove: number, direction: 'up' | 'down') => {
    if (!inventoryList) return;

    // Create a mutable copy of the list
    const newList = [...inventoryList];

    const newIndex = direction === 'up' ? indexToMove - 1 : indexToMove + 1;
    if (newIndex < 0 || newIndex >= newList.length) return;

    // Check if the move is within the same category
    const itemToMove = newList[indexToMove];
    const itemToSwap = newList[newIndex];
    
    if (itemToMove.category === itemToSwap.category) {
        [newList[indexToMove], newList[newIndex]] = [newList[newIndex], newList[indexToMove]];
        // Update the state with the new list
        setInventoryList(newList);
    } else {
        toast({ title: "Thông báo", description: "Chỉ có thể sắp xếp các mục trong cùng một chủng loại."});
    }
  };


  const handleAddItem = () => {
    if (!inventoryList) return;
    const newItem: InventoryItem = {
      id: `item-${Date.now()}`,
      name: 'Mặt hàng mới',
      category: 'CHƯA PHÂN LOẠI',
      supplier: 'Chưa xác định',
      unit: 'cái',
      minStock: 1,
      orderSuggestion: '1'
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

  const onItemsSorted = (sortedNames: string[]) => {
    if (!inventoryList) return;

    const itemMap = new Map(inventoryList.map(item => [item.name, item]));
    const sortedList: InventoryItem[] = sortedNames.map(name => itemMap.get(name)).filter((item): item is InventoryItem => !!item);

    if (sortedList.length === inventoryList.length) {
      handleUpdateAndSave(sortedList);
    } else {
      toast({ title: "Lỗi Sắp xếp", description: "Không thể sắp xếp danh sách. Một vài mặt hàng có thể đã bị thiếu.", variant: "destructive"});
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
      setOpenCategories([]);
  };

  const handleRenameCategory = () => {
    if (!editingCategory || !inventoryList || !editingCategory.newName.trim()) {
        setEditingCategory(null);
        return;
    }

    const { oldName, newName } = editingCategory;
    const newTrimmedName = newName.trim().toUpperCase();

    // Check if new category name already exists
    const categoryExists = categorizedList.some(
        c => c.category.toUpperCase() === newTrimmedName && c.category.toUpperCase() !== oldName.toUpperCase()
    );

    if (categoryExists) {
        toast({ title: "Lỗi", description: `Nhóm sản phẩm "${newTrimmedName}" đã tồn tại.`, variant: "destructive" });
        return;
    }

    const newList = inventoryList.map(item => 
        item.category === oldName ? { ...item, category: newTrimmedName } : item
    );

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
        toast({
            title: "Đã lưu thứ tự mới!",
        });
    }
  };
  
    const handleExport = (type: 'table' | 'text') => {
        if (!inventoryList) return;

        let textToCopy = '';
        if (type === 'table') {
            // Create TSV (Tab-Separated Values) string for easy pasting into Excel
            const headers = ['Tên mặt hàng', 'Nhóm', 'Nhà cung cấp', 'Đơn vị', 'Tồn tối thiểu', 'Gợi ý đặt hàng', 'Yêu cầu ảnh'];
            const rows = inventoryList.map(item => 
                [item.name, item.category, item.supplier, item.unit, item.minStock, item.orderSuggestion, item.requiresPhoto ? 'CÓ' : 'KHÔNG'].join('\t')
            );
            textToCopy = [headers.join('\t'), ...rows].join('\n');
        } else if (type === 'text') {
            textToCopy = inventoryList.map(item => 
                [item.category, item.name, item.supplier, item.unit, item.minStock, item.orderSuggestion].join('-')
            ).join('\n');
        }

        navigator.clipboard.writeText(textToCopy).then(() => {
            toast({
                title: "Đã sao chép!",
                description: "Danh sách đã được sao chép vào bộ nhớ tạm.",
            });
        }).catch(err => {
            toast({
                title: "Lỗi",
                description: "Không thể sao chép danh sách.",
                variant: "destructive",
            });
            console.error("Copy to clipboard failed:", err);
        });
    };

  if (isLoading || authLoading || !inventoryList || !suppliers) {
    return (
      <div className="container mx-auto max-w-5xl p-4 sm:p-6 md:p-8">
        <header className="mb-8">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-4 w-1/2 mt-2" />
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
    <div className="container mx-auto max-w-none p-4 sm:p-6 md:p-8">
      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold font-headline flex items-center gap-3"><Package/> Quản lý Hàng tồn kho</h1>
        <p className="text-muted-foreground">Mọi thay đổi sẽ được lưu tự động. Chế độ sắp xếp sẽ lưu khi bạn nhấn "Lưu thứ tự".</p>
      </header>

      <AiAssistant
        inventoryList={inventoryList}
        onItemsGenerated={onItemsGenerated}
        onItemsSorted={onItemsSorted}
        onItemsUpdated={onItemsUpdated}
      />

      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
                <CardTitle>Danh sách kho hiện tại</CardTitle>
                <CardDescription>Các thay đổi sẽ được lưu tự động.</CardDescription>
            </div>
             <div className="flex items-center gap-2 w-full sm:w-auto">
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full sm:w-auto">
                            <Download className="mr-2 h-4 w-4"/>
                            Xuất dữ liệu
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleExport('table')}>Sao chép (dạng bảng)</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport('text')}>Sao chép (dạng text)</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                 {isSorting ? (
                    <Button variant="default" size="sm" onClick={toggleSortMode} className="w-full sm:w-auto">
                        <Check className="mr-2 h-4 w-4"/>
                        Lưu thứ tự
                    </Button>
                ) : (
                    <Button variant="outline" size="sm" onClick={toggleSortMode} className="w-full sm:w-auto">
                        <Shuffle className="mr-2 h-4 w-4"/>
                        Sắp xếp
                    </Button>
                )}
                {categorizedList && categorizedList.length > 0 && (
                  <Button variant="outline" onClick={handleToggleAll} size="sm" className="w-full sm:w-auto">
                      <ChevronsDownUp className="mr-2 h-4 w-4"/>
                      {areAllCategoriesOpen ? "Thu gọn" : "Mở rộng"}
                  </Button>
                )}
            </div>
        </CardHeader>
        <CardContent className="pt-6">
            <Accordion type="multiple" value={openCategories} onValueChange={setOpenCategories} className="space-y-4">
            {categorizedList.map(({category, items}, categoryIndex) => (
                <AccordionItem value={category} key={category} className="border rounded-lg">
                    <div className="flex items-center p-2">
                        <AccordionTrigger className="text-lg font-semibold flex-1 hover:no-underline p-2" disabled={isSorting}>
                            {editingCategory?.oldName === category ? (
                                <Input
                                    value={editingCategory.newName}
                                    onChange={(e) => setEditingCategory({ ...editingCategory, newName: e.target.value })}
                                    onKeyDown={e => e.key === 'Enter' && handleRenameCategory()}
                                    onBlur={handleRenameCategory}
                                    autoFocus
                                    className="text-lg font-semibold h-9"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            ) : (
                                category
                            )}
                        </AccordionTrigger>
                         {isSorting ? (
                            <div className="flex items-center gap-1 pl-4">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleMoveCategory(categoryIndex, 'up')} disabled={categoryIndex === 0}>
                                    <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleMoveCategory(categoryIndex, 'down')} disabled={categorizedList.length - 1 === categoryIndex}>
                                    <ArrowDown className="h-4 w-4" />
                                </Button>
                            </div>
                         ) : (
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setEditingCategory({ oldName: category, newName: category })}>
                                <Pencil className="h-4 w-4" />
                            </Button>
                         )}
                    </div>
                    <AccordionContent className="p-4 border-t">
                        {/* Mobile view: list of cards */}
                        <div className="md:hidden space-y-4">
                          {items.map((item, index) => {
                             const globalIndex = inventoryList.findIndex(i => i.id === item.id);
                            return (
                              <Card key={item.id}>
                                <CardContent className="p-4 space-y-4">
                                  <div className="flex items-start justify-between">
                                    <div className="space-y-2 flex-1">
                                        <Label htmlFor={`name-${item.id}`}>Tên mặt hàng</Label>
                                        <Input id={`name-${item.id}`} defaultValue={item.name} onBlur={e => handleUpdate(item.id, 'name', e.target.value)} disabled={isSorting} />
                                    </div>
                                    <div className="flex flex-col items-center pl-4">
                                      <Label htmlFor={`photo-m-${item.id}`} className="text-xs mb-2">Y/c ảnh</Label>
                                      <Switch
                                          id={`photo-m-${item.id}`}
                                          checked={item.requiresPhoto}
                                          onCheckedChange={(checked) => handleUpdate(item.id, 'requiresPhoto', checked)}
                                          disabled={isSorting}
                                      />
                                    </div>
                                  </div>
                                   <div className="space-y-2">
                                    <Label htmlFor={`supplier-m-${item.id}`}>Nhà cung cấp</Label>
                                    <SupplierCombobox
                                      suppliers={suppliers}
                                      value={item.supplier}
                                      onChange={(newSupplier) => handleSupplierChange(item.id, newSupplier)}
                                      disabled={isSorting}
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label htmlFor={`unit-${item.id}`}>Đơn vị</Label>
                                      <Input id={`unit-${item.id}`} defaultValue={item.unit} onBlur={e => handleUpdate(item.id, 'unit', e.target.value)} disabled={isSorting} />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor={`minStock-${item.id}`}>Tồn tối thiểu</Label>
                                      <Input id={`minStock-${item.id}`} type="number" defaultValue={item.minStock} onBlur={e => handleUpdate(item.id, 'minStock', parseInt(e.target.value) || 0)} disabled={isSorting}/>
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor={`orderSuggestion-${item.id}`}>Gợi ý đặt hàng</Label>
                                    <Input id={`orderSuggestion-${item.id}`} defaultValue={item.orderSuggestion} onBlur={e => handleUpdate(item.id, 'orderSuggestion', e.target.value)} disabled={isSorting}/>
                                  </div>

                                  <div className="flex items-center justify-end gap-0 border-t pt-4">
                                    {isSorting ? (
                                      <>
                                        <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => handleMoveItem(globalIndex, 'up')} disabled={index === 0}>
                                          <ArrowUp className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => handleMoveItem(globalIndex, 'down')} disabled={index === items.length - 1}>
                                          <ArrowDown className="h-4 w-4" />
                                        </Button>
                                      </>
                                    ) : (
                                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDeleteItem(item.id)}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            )
                          })}
                        </div>
                        {/* Desktop view: table */}
                        <div className="overflow-x-auto hidden md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="min-w-[300px] whitespace-nowrap">Tên mặt hàng</TableHead>
                                        <TableHead className="whitespace-nowrap">Nhà cung cấp</TableHead>
                                        <TableHead className="min-w-[100px] whitespace-nowrap">Đơn vị</TableHead>
                                        <TableHead className="min-w-[100px]">Tồn tối thiểu</TableHead>
                                        <TableHead className="min-w-[120px]">Gợi ý đặt hàng</TableHead>
                                        <TableHead className="text-center">Y/c ảnh</TableHead>
                                        <TableHead className="text-right w-[50px] whitespace-nowrap">Hành động</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map((item, index) => {
                                        const globalIndex = inventoryList.findIndex(i => i.id === item.id);
                                        return (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                               <div className="flex items-center gap-2">
                                                 {item.requiresPhoto && <Star className="h-4 w-4 text-yellow-500 shrink-0" />}
                                                 <Input defaultValue={item.name} onBlur={e => handleUpdate(item.id, 'name', e.target.value)} disabled={isSorting} className="border-none p-0 h-auto focus-visible:ring-0" />
                                               </div>
                                            </TableCell>
                                            <TableCell>
                                                <SupplierCombobox
                                                    suppliers={suppliers}
                                                    value={item.supplier}
                                                    onChange={(newSupplier) => handleSupplierChange(item.id, newSupplier)}
                                                    disabled={isSorting}
                                                />
                                            </TableCell>
                                            <TableCell className="w-[150px]">
                                                <Input defaultValue={item.unit} onBlur={e => handleUpdate(item.id, 'unit', e.target.value)} disabled={isSorting} />
                                            </TableCell>
                                            <TableCell className="w-[120px]">
                                                <Input type="number" defaultValue={item.minStock} onBlur={e => handleUpdate(item.id, 'minStock', parseInt(e.target.value) || 0)} disabled={isSorting}/>
                                            </TableCell>
                                            <TableCell className="w-[120px]">
                                                <Input defaultValue={item.orderSuggestion} onBlur={e => handleUpdate(item.id, 'orderSuggestion', e.target.value)} disabled={isSorting}/>
                                            </TableCell>
                                             <TableCell className="text-center w-[100px]">
                                                <Switch
                                                    checked={item.requiresPhoto}
                                                    onCheckedChange={(checked) => handleUpdate(item.id, 'requiresPhoto', checked)}
                                                    disabled={isSorting}
                                                />
                                            </TableCell>
                                            <TableCell className="text-right w-[50px]">
                                                <div className="flex items-center justify-end gap-0">
                                                {isSorting ? (
                                                    <>
                                                        <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => handleMoveItem(globalIndex, 'up')} disabled={index === 0}>
                                                            <ArrowUp className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => handleMoveItem(globalIndex, 'down')} disabled={index === items.length - 1}>
                                                            <ArrowDown className="h-4 w-4" />
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDeleteItem(item.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )})}
                                </TableBody>
                            </Table>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            ))}
            </Accordion>

            <div className="mt-6 flex justify-start items-center">
                <Button variant="outline" onClick={handleAddItem}>
                    <Plus className="mr-2 h-4 w-4" />
                    Thêm mặt hàng mới
                </Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
