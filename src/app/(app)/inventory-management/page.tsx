
'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { dataStore } from '@/lib/data-store';
import type { InventoryItem, ParsedInventoryItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Package, ArrowUp, ArrowDown, Wand2, Loader2, FileText, Image as ImageIcon, CheckCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { generateInventoryList } from '@/ai/flows/generate-inventory-list';

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
                <CardTitle className="flex items-center gap-2"><Wand2 /> Thêm hàng loạt bằng AI</CardTitle>
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

  useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'Chủ nhà hàng') {
        router.replace('/');
      } else {
        const unsubscribe = dataStore.subscribeToInventoryList((items) => {
          setInventoryList(items); // Keep original order from DB
          setIsLoading(false);
        });
        return () => unsubscribe();
      }
    }
  }, [user, authLoading, router]);
  
  const sortAndSetList = useCallback((list: InventoryItem[]) => {
      const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
      setInventoryList(sorted);
      return sorted;
  }, []);

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
    
    [newList[indexToMove], newList[newIndex]] = [newList[newIndex], newList[indexToMove]];
    setInventoryList(newList);
  };
  
  const handleSaveChanges = () => {
      if(!inventoryList) return;
      dataStore.updateInventoryList(inventoryList).then(() => { // Save with current (potentially manual) order
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
      name: 'Mặt hàng mới',
      unit: 'cái',
      minStock: 1,
      orderSuggestion: '1'
    };
    const newList = [...inventoryList, newItem];
    sortAndSetList(newList);
  };
  
  const onItemsGenerated = (items: InventoryItem[]) => {
      if (inventoryList) {
          const newList = [...inventoryList, ...items];
          sortAndSetList(newList);
      }
  }

  const handleDeleteItem = (id: string) => {
    if (!inventoryList) return;
    const newList = inventoryList.filter(item => item.id !== id);
    setInventoryList(newList);
  };
  
  const categorizedList = useMemo((): CategorizedList => {
      if (!inventoryList) return [];
      
      const grouped: { [key: string]: InventoryItem[] } = {};
      inventoryList.forEach(item => {
          const category = item.name.includes(' - ') ? item.name.split(' - ')[0].toUpperCase() : 'CHƯA PHÂN LOẠI';
          if (!grouped[category]) {
              grouped[category] = [];
          }
          grouped[category].push(item);
      });
      
      return Object.entries(grouped)
        .sort(([catA], [catB]) => catA.localeCompare(catB))
        .map(([category, items]) => ({ category, items }));

  }, [inventoryList]);

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

  return (
    <div className="container mx-auto max-w-5xl p-4 sm:p-6 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Package/> Quản lý Hàng tồn kho</h1>
        <p className="text-muted-foreground">Thêm, sửa, xóa và sắp xếp các mặt hàng trong danh sách kiểm kê kho.</p>
      </header>

      <AiInventoryGenerator inventoryList={inventoryList} onItemsGenerated={onItemsGenerated} />

      <Card>
        <CardHeader>
            <CardTitle>Danh sách kho hiện tại</CardTitle>
            <CardDescription>Các thay đổi sẽ không được lưu cho đến khi bạn nhấn nút "Lưu tất cả thay đổi".</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
            {categorizedList.map(({category, items}) => {
                 const globalStartIndex = inventoryList.findIndex(item => item.id === items[0]?.id);
                 return (
                    <div key={category}>
                        <h3 className="text-lg font-semibold mb-2 pl-2">{category}</h3>
                        <div className="overflow-x-auto border rounded-lg">
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
                                    {items.map((item, localIndex) => {
                                        const globalIndex = inventoryList.findIndex(i => i.id === item.id);
                                        return (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <Input value={item.name} onChange={e => handleUpdate(item.id, 'name', e.target.value)} />
                                            </TableCell>
                                            <TableCell>
                                                <Input value={item.unit} onChange={e => handleUpdate(item.id, 'unit', e.target.value)} className="w-24" />
                                            </TableCell>
                                            <TableCell>
                                                <Input type="number" value={item.minStock} onChange={e => handleUpdate(item.id, 'minStock', parseInt(e.target.value) || 0)} className="w-24" />
                                            </TableCell>
                                            <TableCell>
                                                <Input value={item.orderSuggestion} onChange={e => handleUpdate(item.id, 'orderSuggestion', e.target.value)} className="w-28"/>
                                            </TableCell>
                                            <TableCell className="text-right flex items-center justify-end gap-0">
                                                <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => handleMoveItem(globalIndex, 'up')} disabled={globalIndex === 0}>
                                                    <ArrowUp className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => handleMoveItem(globalIndex, 'down')} disabled={globalIndex === inventoryList.length - 1}>
                                                    <ArrowDown className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDeleteItem(item.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )})}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )
            })}
            
            <div className="mt-6 flex justify-between items-center">
                <Button variant="outline" onClick={handleAddItem}>
                    <Plus className="mr-2 h-4 w-4" />
                    Thêm mặt hàng
                </Button>
                <Button onClick={handleSaveChanges}>Lưu tất cả thay đổi</Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
