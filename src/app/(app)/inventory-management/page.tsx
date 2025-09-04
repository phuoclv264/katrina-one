
'use client';
import { useState, useEffect } from 'react';
import { dataStore } from '@/lib/data-store';
import type { InventoryItem, ParsedInventoryItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Package, ArrowUp, ArrowDown, Wand2, Loader2, FileText, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { generateInventoryList } from '@/ai/flows/generate-inventory-list';

function AiInventoryGenerator({ onItemsGenerated }: { onItemsGenerated: (items: InventoryItem[]) => void }) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [textInput, setTextInput] = useState('');
    const [imageInput, setImageInput] = useState<string | null>(null);
    const { toast } = useToast();

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

    const handleGenerate = async (source: 'text' | 'image') => {
        setIsGenerating(true);
        try {
            const input = source === 'text' 
                ? { source, inputText: textInput }
                : { source, imageDataUri: imageInput! };
            
            if ((source === 'text' && !textInput) || (source === 'image' && !imageInput)) {
                toast({ title: "Lỗi", description: "Vui lòng cung cấp đầu vào.", variant: "destructive" });
                return;
            }
            
            toast({ title: "AI đang xử lý...", description: "Quá trình này có thể mất một chút thời gian."});

            const result = await generateInventoryList(input);
            
            const newItems: InventoryItem[] = result.items.map(item => ({
                ...item,
                id: `item-${Date.now()}-${Math.random()}`
            }));

            onItemsGenerated(newItems);
            toast({ title: "Thành công!", description: `AI đã nhận diện được ${newItems.length} mặt hàng.`});
            setTextInput('');
            setImageInput(null);

        } catch (error) {
            console.error("Failed to generate inventory list:", error);
            toast({ title: "Lỗi", description: "Không thể tạo danh sách từ đầu vào. Vui lòng thử lại.", variant: "destructive"});
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Card className="mb-8">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Wand2 /> Thêm hàng loạt bằng AI</CardTitle>
                <CardDescription>Dán dữ liệu từ bảng tính hoặc tải ảnh lên để AI tự động tạo danh sách hàng tồn kho.</CardDescription>
            </CardHeader>
            <CardContent>
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
                        <Button onClick={() => handleGenerate('text')} disabled={isGenerating || !textInput}>
                            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                            Tạo danh sách từ văn bản
                        </Button>
                    </TabsContent>
                    <TabsContent value="image" className="mt-4 space-y-4">
                        <Input 
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
            </CardContent>
        </Card>
    )
}

export default function InventoryManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [inventoryList, setInventoryList] = useState<InventoryItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [parsedItems, setParsedItems] = useState<InventoryItem[]>([]);

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

  const handleUpdate = (index: number, field: keyof InventoryItem, value: string | number) => {
    if (!inventoryList) return;
    const newList = [...inventoryList];
    (newList[index] as any)[field] = value;
    setInventoryList(newList);
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    if (!inventoryList) return;
    const newList = [...inventoryList];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newList.length) return;
    [newList[index], newList[newIndex]] = [newList[newIndex], newList[index]];
    setInventoryList(newList);
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
      name: 'Mặt hàng mới',
      unit: 'cái',
      minStock: 1,
      orderSuggestion: '1'
    };
    setInventoryList([...inventoryList, newItem]);
  };

  const handleDeleteItem = (id: string) => {
    if (!inventoryList) return;
    const newList = inventoryList.filter(item => item.id !== id);
    setInventoryList(newList);
  };

  const handleAddParsedItems = () => {
    if (!inventoryList) return;
    setInventoryList(prev => [...prev!, ...parsedItems]);
    setParsedItems([]);
    toast({ title: "Thành công", description: `${parsedItems.length} mặt hàng đã được thêm vào danh sách chính.`});
  }
  
  if (isLoading || authLoading) {
    return (
      <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">
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

  if (!inventoryList) {
    return <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">Không thể tải danh sách hàng tồn kho.</div>;
  }

  return (
    <div className="container mx-auto max-w-5xl p-4 sm:p-6 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Package/> Quản lý Hàng tồn kho</h1>
        <p className="text-muted-foreground">Thêm, sửa, xóa và sắp xếp các mặt hàng trong danh sách kiểm kê kho.</p>
      </header>

      <AiInventoryGenerator onItemsGenerated={setParsedItems} />

      {parsedItems.length > 0 && (
          <Card className="mb-8">
              <CardHeader>
                  <CardTitle>Kết quả từ AI</CardTitle>
                  <CardDescription>Đây là các mặt hàng được AI nhận diện. Kiểm tra và thêm vào kho.</CardDescription>
              </CardHeader>
              <CardContent>
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>Tên mặt hàng</TableHead>
                              <TableHead>Đơn vị</TableHead>
                              <TableHead>Tồn tối thiểu</TableHead>
                              <TableHead>Gợi ý đặt hàng</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {parsedItems.map(item => (
                              <TableRow key={item.id}>
                                  <TableCell>{item.name}</TableCell>
                                  <TableCell>{item.unit}</TableCell>
                                  <TableCell>{item.minStock}</TableCell>
                                  <TableCell>{item.orderSuggestion}</TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                  </Table>
                   <div className="mt-4 flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setParsedItems([])}>Hủy</Button>
                        <Button onClick={handleAddParsedItems}>Thêm {parsedItems.length} mặt hàng vào kho</Button>
                    </div>
              </CardContent>
          </Card>
      )}

      <Card>
        <CardHeader>
            <CardTitle>Danh sách kho hiện tại</CardTitle>
            <CardDescription>Các thay đổi sẽ không được lưu cho đến khi bạn nhấn nút "Lưu tất cả thay đổi".</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
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
                        {inventoryList.map((item, index) => (
                            <TableRow key={item.id}>
                                <TableCell>
                                    <Input value={item.name} onChange={e => handleUpdate(index, 'name', e.target.value)} />
                                </TableCell>
                                <TableCell>
                                    <Input value={item.unit} onChange={e => handleUpdate(index, 'unit', e.target.value)} className="w-24" />
                                </TableCell>
                                <TableCell>
                                    <Input type="number" value={item.minStock} onChange={e => handleUpdate(index, 'minStock', parseInt(e.target.value) || 0)} className="w-24" />
                                </TableCell>
                                <TableCell>
                                    <Input value={item.orderSuggestion} onChange={e => handleUpdate(index, 'orderSuggestion', e.target.value)} className="w-28"/>
                                </TableCell>
                                <TableCell className="text-right flex items-center justify-end gap-0">
                                    <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => handleMoveItem(index, 'up')} disabled={index === 0}>
                                        <ArrowUp className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => handleMoveItem(index, 'down')} disabled={index === inventoryList.length - 1}>
                                        <ArrowDown className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDeleteItem(item.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
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
