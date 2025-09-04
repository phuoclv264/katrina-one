
'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { dataStore } from '@/lib/data-store';
import type { InventoryItem, ParsedInventoryItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Package, ArrowUp, ArrowDown, Wand2, Loader2, FileText, Image as ImageIcon, CheckCircle, AlertTriangle, ChevronsDownUp, Shuffle, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { generateInventoryList } from '@/ai/flows/generate-inventory-list';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

function AiInventoryGenerator({ 
    inventoryList,
    onItemsGenerated 
}: { 
    inventoryList: InventoryItem[],
    onItemsGenerated: (items: InventoryItem[]) => void 
}) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [textInput, setTextInput] = useState('');
    const [imageInput, setImageInput] = useState<string | null>(null);
    const { toast } = useToast();

    const [newItems, setNewItems] = useState<InventoryItem[]>([]);
    const [existingItems, setExistingItems] = useState<ParsedInventoryItem[]>([]);
    const [hasResult, setHasResult] = useState(false);

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
        setNewItems([]);
        setExistingItems([]);
        setHasResult(false);
        setTextInput('');
        setImageInput(null);
        // Also reset the file input visually
        const fileInput = document.getElementById('image-upload') as HTMLInputElement;
        if(fileInput) fileInput.value = '';
    }

    const handleGenerate = async (source: 'text' | 'image') => {
        setIsGenerating(true);
        setHasResult(false); // Reset previous results

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
            
            // --- Logic to compare with existing inventory ---
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

            setNewItems(generatedNewItems);
            setExistingItems(generatedExistingItems);
            setHasResult(true);
            
            toast({ title: "Hoàn tất!", description: `AI đã nhận diện được ${result.items.length} mặt hàng. ${generatedNewItems.length} mặt hàng mới.`});

        } catch (error) {
            console.error("Failed to generate inventory list:", error);
            toast({ title: "Lỗi", description: "Không thể tạo danh sách từ đầu vào. Vui lòng thử lại.", variant: "destructive"});
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleAddItems = () => {
        onItemsGenerated(newItems);
        resetState();
    }

    const handleEditNewItem = (index: number, field: keyof InventoryItem, value: string | number) => {
        const updatedItems = [...newItems];
        (updatedItems[index] as any)[field] = value;
        setNewItems(updatedItems);
    }
    
    const handleDeleteNewItem = (id: string) => {
        const updatedItems = newItems.filter(item => item.id !== id);
        setNewItems(updatedItems);
    }


    return (
        <Card className="mb-8">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl"><Wand2 /> Thêm hàng loạt bằng AI</CardTitle>
                <CardDescription>Dán dữ liệu từ bảng tính hoặc tải ảnh lên để AI tự động tạo danh sách hàng tồn kho.</CardDescription>
            </CardHeader>
            <CardContent>
                {!hasResult && (
                    <Tabs defaultValue="text">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="text"><FileText className="mr-2 h-4 w-4"/>Dán văn bản</TabsTrigger>
                            <TabsTrigger value="image"><ImageIcon className="mr-2 h-4 w-4"/>Tải ảnh lên</TabsTrigger>
                        </TabsList>
                        <TabsContent value="text" className="mt-4 space-y-4">
                            <Textarea 
                                placeholder="Dán dữ liệu từ Excel/Google Sheets vào đây. Mỗi dòng là một mặt hàng, các cột bao gồm Tên, Đơn vị, Tồn tối thiểu, Gợi ý đặt hàng."
                                rows={6}
                                value={textInput}
                                onChange={(e) => setTextInput(e.target.value)}
                                disabled={isGenerating}
                            />
                            <Button onClick={() => handleGenerate('text')} disabled={isGenerating || !textInput.trim()}>
                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                Tạo danh sách từ văn bản
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
                            {imageInput && (
                                <div className="text-center text-sm text-muted-foreground">
                                    <p>Đã chọn ảnh. Nhấn nút bên dưới để xử lý.</p>
                                </div>
                            )}
                            <Button onClick={() => handleGenerate('image')} disabled={isGenerating || !imageInput}>
                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                Tạo danh sách từ ảnh
                            </Button>
                        </TabsContent>
                    </Tabs>
                )}

                {hasResult && (
                    <div className="space-y-6">
                        {newItems.length > 0 && (
                             <div className="space-y-4">
                                <h3 className="text-lg font-semibold flex items-center gap-2"><CheckCircle className="text-green-500"/> Mặt hàng mới (Có thể chỉnh sửa)</h3>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Tên mặt hàng</TableHead>
                                                <TableHead>Đơn vị</TableHead>
                                                <TableHead>Tồn tối thiểu</TableHead>
                                                <TableHead>Gợi ý đặt hàng</TableHead>
                                                <TableHead className="text-right">Xóa</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {newItems.map((item, index) => (
                                                <TableRow key={item.id}>
                                                    <TableCell><Input value={item.name} onChange={e => handleEditNewItem(index, 'name', e.target.value)} /></TableCell>
                                                    <TableCell><Input value={item.unit} onChange={e => handleEditNewItem(index, 'unit', e.target.value)} className="w-24" /></TableCell>
                                                    <TableCell><Input type="number" value={item.minStock} onChange={e => handleEditNewItem(index, 'minStock', parseInt(e.target.value) || 0)} className="w-24" /></TableCell>
                                                    <TableCell><Input value={item.orderSuggestion} onChange={e => handleEditNewItem(index, 'orderSuggestion', e.target.value)} className="w-28" /></TableCell>
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

                       {existingItems.length > 0 && (
                             <div className="space-y-4">
                               <h3 className="text-lg font-semibold flex items-center gap-2"><AlertTriangle className="text-yellow-500"/> Mặt hàng đã có trong kho (sẽ được bỏ qua)</h3>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Tên mặt hàng</TableHead>
                                            <TableHead>Đơn vị</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {existingItems.map((item, index) => (
                                            <TableRow key={index} className="bg-muted/50">
                                                <TableCell>{item.name}</TableCell>
                                                <TableCell>{item.unit}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                        
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={resetState}>Hủy bỏ</Button>
                            <Button onClick={handleAddItems} disabled={newItems.length === 0}>
                                <Plus className="mr-2 h-4 w-4" />
                                Thêm {newItems.length} mặt hàng mới vào kho
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
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
  const [isLoading, setIsLoading] = useState(true);
  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const [isSorting, setIsSorting] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'Chủ nhà hàng') {
        router.replace('/');
      } else {
        const unsubscribe = dataStore.subscribeToInventoryList((items) => {
          setInventoryList(items); 
          setIsLoading(false);
        });
        return () => unsubscribe();
      }
    }
  }, [user, authLoading, router]);
  
  const categorizedList = useMemo((): CategorizedList => {
      if (!inventoryList) return [];
      
      const categoryOrder: string[] = [];
      const grouped: { [key: string]: InventoryItem[] } = {};

      inventoryList.forEach(item => {
          const category = item.name.includes(' - ') ? item.name.split(' - ')[0].trim().toUpperCase() : 'CHƯA PHÂN LOẠI';
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


  const handleUpdate = (id: string, field: keyof InventoryItem, value: string | number) => {
    if (!inventoryList) return;
    const newList = inventoryList.map(item => 
        item.id === id ? {...item, [field]: value} : item
    );
    setInventoryList(newList);
  };
  
  const handleMoveItem = (indexToMove: number, direction: 'up' | 'down') => {
    if (!inventoryList) return;
    const newList = [...inventoryList];
    const newIndex = direction === 'up' ? indexToMove - 1 : indexToMove + 1;
    if (newIndex < 0 || newIndex >= newList.length) return;
    
    // Check if the move is within the same category
    const itemToMove = newList[indexToMove];
    const itemToSwap = newList[newIndex];
    const categoryOfItemToMove = itemToMove.name.includes(' - ') ? itemToMove.name.split(' - ')[0].trim().toUpperCase() : 'CHƯA PHÂN LOẠI';
    const categoryOfItemToSwap = itemToSwap.name.includes(' - ') ? itemToSwap.name.split(' - ')[0].trim().toUpperCase() : 'CHƯA PHÂN LOẠI';

    if (categoryOfItemToMove === categoryOfItemToSwap) {
        [newList[indexToMove], newList[newIndex]] = [newList[newIndex], newList[indexToMove]];
        setInventoryList(newList);
    } else {
        toast({ title: "Thông báo", description: "Chỉ có thể sắp xếp các mục trong cùng một chủng loại."});
    }
  };
  
  const handleSaveChanges = () => {
      if(!inventoryList) return;
      dataStore.updateInventoryList(inventoryList).then(() => {
          toast({
              title: "Đã lưu thay đổi!",
              description: "Danh sách hàng tồn kho đã được cập nhật.",
          });
      }).catch(err => {
          toast({
              title: "Lỗi!",
              description: "Không thể lưu thay đổi. Vui lòng thử lại.",
              variant: "destructive"
          });
          console.error(err);
      });
  }

  const handleAddItem = () => {
    if (!inventoryList) return;
    const newItem: InventoryItem = {
      id: `item-${Date.now()}`,
      name: 'CHƯA PHÂN LOẠI - Mặt hàng mới',
      unit: 'cái',
      minStock: 1,
      orderSuggestion: '1'
    };
    const newList = [...inventoryList, newItem];
    setInventoryList(newList);
  };
  
  const onItemsGenerated = (items: InventoryItem[]) => {
      if (inventoryList) {
          const newList = [...inventoryList, ...items];
          setInventoryList(newList);
      }
  }

  const handleDeleteItem = (id: string) => {
    if (!inventoryList) return;
    const newList = inventoryList.filter(item => item.id !== id);
    setInventoryList(newList);
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

   const handleToggleAll = () => {
    if (openCategories.length === categorizedList.length) {
      setOpenCategories([]);
    } else {
      setOpenCategories(categorizedList.map(c => c.category));
    }
  };

  const toggleSortMode = () => {
    const newSortState = !isSorting;
    setIsSorting(newSortState);
    if (!newSortState) {
        handleSaveChanges();
    }
  };

  if (isLoading || authLoading || !inventoryList) {
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
   const areAllCategoriesOpen = categorizedList.length > 0 && openCategories.length === categorizedList.length;

  return (
    <div className="container mx-auto max-w-5xl p-4 sm:p-6 md:p-8">
      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold font-headline flex items-center gap-3"><Package/> Quản lý Hàng tồn kho</h1>
        <p className="text-muted-foreground">Thêm, sửa, xóa và sắp xếp các mặt hàng trong danh sách kiểm kê kho.</p>
      </header>

      <AiInventoryGenerator inventoryList={inventoryList} onItemsGenerated={onItemsGenerated} />

      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
                <CardTitle>Danh sách kho hiện tại</CardTitle>
                <CardDescription>Các thay đổi về nội dung sẽ được lưu khi bạn nhấn nút "Lưu tất cả thay đổi".</CardDescription>
            </div>
             <div className="flex items-center gap-2 w-full sm:w-auto">
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
                {categorizedList.length > 0 && (
                  <Button variant="outline" onClick={handleToggleAll} size="sm" className="w-full sm:w-auto">
                      <ChevronsDownUp className="mr-2 h-4 w-4"/>
                      {areAllCategoriesOpen ? "Thu gọn" : "Mở rộng"}
                  </Button>
                )}
                <Button onClick={handleSaveChanges} size="sm" className="w-full sm:w-auto">Lưu tất cả thay đổi</Button>
            </div>
        </CardHeader>
        <CardContent className="pt-6">
            <Accordion type="multiple" value={openCategories} onValueChange={setOpenCategories} className="space-y-4">
            {categorizedList.map(({category, items}, categoryIndex) => (
                <AccordionItem value={category} key={category} className="border rounded-lg">
                    <div className="flex items-center p-2">
                        <AccordionTrigger className="text-lg font-semibold flex-1 hover:no-underline p-2" disabled={isSorting}>
                            {category}
                        </AccordionTrigger>
                         {isSorting && (
                            <div className="flex items-center gap-1 pl-4">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleMoveCategory(categoryIndex, 'up')} disabled={categoryIndex === 0}>
                                    <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleMoveCategory(categoryIndex, 'down')} disabled={categoryIndex === categorizedList.length - 1}>
                                    <ArrowDown className="h-4 w-4" />
                                </Button>
                            </div>
                         )}
                    </div>
                    <AccordionContent className="p-4 border-t">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="min-w-[300px]">Tên mặt hàng</TableHead>
                                        <TableHead>Đơn vị</TableHead>
                                        <TableHead>Tồn tối thiểu</TableHead>
                                        <TableHead>Gợi ý đặt hàng</TableHead>
                                        <TableHead className="text-right">Hành động</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map((item) => {
                                        const globalIndex = inventoryList.findIndex(i => i.id === item.id);
                                        return (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <Input value={item.name} onChange={e => handleUpdate(item.id, 'name', e.target.value)} disabled={isSorting} />
                                            </TableCell>
                                            <TableCell>
                                                <Input value={item.unit} onChange={e => handleUpdate(item.id, 'unit', e.target.value)} className="w-24" disabled={isSorting} />
                                            </TableCell>
                                            <TableCell>
                                                <Input type="number" value={item.minStock} onChange={e => handleUpdate(item.id, 'minStock', parseInt(e.target.value) || 0)} className="w-24" disabled={isSorting}/>
                                            </TableCell>
                                            <TableCell>
                                                <Input value={item.orderSuggestion} onChange={e => handleUpdate(item.id, 'orderSuggestion', e.target.value)} className="w-28" disabled={isSorting}/>
                                            </TableCell>
                                            <TableCell className="text-right flex items-center justify-end gap-0">
                                                {isSorting ? (
                                                    <>
                                                        <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => handleMoveItem(globalIndex, 'up')} disabled={items.findIndex(i => i.id === item.id) === 0}>
                                                            <ArrowUp className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => handleMoveItem(globalIndex, 'down')} disabled={items.findIndex(i => i.id === item.id) === items.length - 1}>
                                                            <ArrowDown className="h-4 w-4" />
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDeleteItem(item.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
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
