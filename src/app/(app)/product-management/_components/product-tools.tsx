'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { InventoryItem, ParsedProduct, ProductIngredient, Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Wand2, Loader2, FileText, Image as ImageIcon, CheckCircle, AlertTriangle, Search, Info, Plus, FileUp, Replace, FileEdit } from 'lucide-react';
import { toast } from '@/components/ui/pro-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { callGenerateProductRecipes } from '@/lib/ai-service';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

type AiPreviewState = {
    newProducts: ParsedProduct[];
    existingProducts: {
        product: ParsedProduct;
        action: 'skip' | 'overwrite';
    }[];
};

type ProductToolsProps = {
    inventoryList: InventoryItem[];
    existingProducts: Product[];
    onProductsGenerated: (productsToAdd: ParsedProduct[], productsToUpdate: ParsedProduct[]) => void;
};

export default function ProductTools({ inventoryList, existingProducts, onProductsGenerated }: ProductToolsProps) {
    const [isGenerating, setIsGenerating] = useState(false);

    const [textInput, setTextInput] = useState('');
    const [imageInput, setImageInput] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [previewState, setPreviewState] = useState<AiPreviewState>({ newProducts: [], existingProducts: [] });

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => { setImageInput(reader.result as string); };
            reader.readAsDataURL(file);
        }
    };

    const resetState = () => {
        setTextInput('');
        setImageInput(null);
        const fileInput = document.getElementById('product-image-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
    };

    const handleGenerate = async (source: 'text' | 'image') => {
        const inputToProcess = source === 'text' ? textInput : imageInput;
        if (!inputToProcess || (typeof inputToProcess === 'string' && !inputToProcess.trim())) {
            toast.error("Vui lòng cung cấp danh sách công thức.");
            return;
        }

        setIsGenerating(true);
        toast.loading("AI đang phân tích công thức... (có thể mất vài phút)");

        try {
            // Split the text into chunks of 10 products
            const productChunks = typeof inputToProcess === 'string'
                ? inputToProcess.split(/\n(?=\d+\.\s)/).reduce((acc: string[][], line) => {
                    if (!acc.length || acc[acc.length - 1].length === 10) {
                        acc.push([]);
                    }
                    acc[acc.length - 1].push(line);
                    return acc;
                }, [])
                : [[inputToProcess]]; // For image, process as a single chunk

            const processingPromises = productChunks.map(chunk =>
                callGenerateProductRecipes({
                    inputText: source === 'text' ? chunk.join('\n') : undefined,
                    imageDataUri: source === 'image' ? chunk[0] : undefined,
                    inventoryItems: inventoryList,
                    allProducts: existingProducts,
                })
            );

            const results = await Promise.allSettled(processingPromises);

            let allProducts: ParsedProduct[] = [];
            let failedChunks = 0;

            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value?.products) {
                    allProducts.push(...result.value.products);
                } else {
                    failedChunks++;
                    console.error(`Chunk ${index + 1} failed to process:`, result.status === 'rejected' ? result.reason : 'No products returned');
                }
            });

            if (allProducts.length === 0) {
                throw new Error("AI không thể nhận diện được công thức nào từ văn bản đã cung cấp.");
            }

            if (failedChunks > 0) {
                toast.error(`AI không thể xử lý ${failedChunks} phần của danh sách. Vui lòng kiểm tra lại định dạng của các phần đó.`);
            }


            const existingNames = new Set(existingProducts.map(p => p.name.toLowerCase()));
            const newProducts: ParsedProduct[] = [];
            const existingProductsFound: { product: ParsedProduct, action: 'skip' | 'overwrite' }[] = [];

            allProducts.forEach(p => {
                if (existingNames.has(p.name.toLowerCase())) {
                    existingProductsFound.push({ product: p, action: 'skip' });
                } else {
                    newProducts.push(p);
                }
            });

            setPreviewState({ newProducts, existingProducts: existingProductsFound });
            setShowPreview(true);

        } catch (error: any) {
            console.error("Failed to generate product recipes:", error);
            toast.error(error.message || "Không thể tạo công thức từ đầu vào.");
        } finally {
            setIsGenerating(false);
            toast.dismiss();
        }
    };

    const handleToggleOverwrite = (productName: string) => {
        setPreviewState(prev => ({
            ...prev,
            existingProducts: prev.existingProducts.map(p =>
                p.product.name === productName
                    ? { ...p, action: p.action === 'skip' ? 'overwrite' : 'skip' }
                    : p
            )
        }));
    };

    const handleToggleAllOverwrite = (overwriteAll: boolean) => {
        setPreviewState(prev => ({
            ...prev,
            existingProducts: prev.existingProducts.map(p => ({ ...p, action: overwriteAll ? 'overwrite' : 'skip' }))
        }));
    };

    const handleConfirm = () => {
        const productsToAdd = previewState.newProducts;
        const productsToUpdate = previewState.existingProducts
            .filter(p => p.action === 'overwrite')
            .map(p => p.product);

        onProductsGenerated(productsToAdd, productsToUpdate);

        let message = '';
        if (productsToAdd.length > 0) message += `Đã thêm ${productsToAdd.length} mặt hàng mới. `;
        if (productsToUpdate.length > 0) message += `Đã ghi đè ${productsToUpdate.length} mặt hàng.`;
        toast.success(message.trim() || "Không có thay đổi nào được áp dụng.");

        resetState();
        setShowPreview(false);
    };

    return (
        <>
            <Card className="mb-8 rounded-xl shadow-sm border bg-white dark:bg-card">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl"><Wand2 /> Công cụ AI</CardTitle>
                    <CardDescription>Sử dụng AI để tự động nhập hoặc cập nhật hàng loạt công thức.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="add" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="add"><Plus className="mr-2 h-4 w-4" />Thêm bằng AI</TabsTrigger>
                            <TabsTrigger value="bulk-edit"><FileEdit className="mr-2 h-4 w-4" />Xử lý hàng loạt</TabsTrigger>
                        </TabsList>

                        <TabsContent value="add" className="mt-4 space-y-4">
                            <Tabs defaultValue="text" className="w-full">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="text"><FileText className="mr-2 h-4 w-4" />Nhập văn bản</TabsTrigger>
                                    <TabsTrigger value="image"><ImageIcon className="mr-2 h-4 w-4" />Tải ảnh lên</TabsTrigger>
                                </TabsList>
                                <TabsContent value="text" className="mt-4 space-y-4">
                                    <Textarea placeholder="Dán văn bản hoặc mô tả công thức tự do vào đây..." rows={6} value={textInput} onChange={(e) => setTextInput(e.target.value)} disabled={isGenerating} />
                                    <Button onClick={() => handleGenerate('text')} disabled={isGenerating || !textInput.trim()} className="h-10 w-full"><Wand2 className="mr-2 h-4 w-4" />Tạo danh sách</Button>
                                </TabsContent>
                                <TabsContent value="image" className="mt-4 space-y-4">
                                    <Input id="product-image-upload" type="file" accept="image/*" onChange={handleFileChange} disabled={isGenerating} />
                                    <Button onClick={() => handleGenerate('image')} disabled={isGenerating || !imageInput} className="h-10 w-full"><Wand2 className="mr-2 h-4 w-4" />Tạo từ ảnh</Button>
                                </TabsContent>
                            </Tabs>
                        </TabsContent>

                        <TabsContent value="bulk-edit" className="mt-4 space-y-4">
                            <Textarea placeholder="Dán nội dung từ file đã xuất (đã chỉnh sửa) vào đây để cập nhật hoặc thêm mới hàng loạt..." rows={8} value={textInput} onChange={(e) => setTextInput(e.target.value)} disabled={isGenerating} />
                            <Button onClick={() => handleGenerate('text')} disabled={isGenerating || !textInput.trim()} className="h-10 w-full"><Wand2 className="mr-2 h-4 w-4" />Xử lý văn bản</Button>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <Dialog open={showPreview} onOpenChange={setShowPreview} dialogTag="product-preview-dialog" parentDialogTag="product-tools">
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Xem trước Công thức đã tạo</DialogTitle>
                        <DialogDescription>AI đã phân tích và liên kết các nguyên liệu. Vui lòng kiểm tra và xác nhận.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                        <div className="py-4 space-y-6">
                            {/* New Products */}
                            {previewState.newProducts.length > 0 && (
                                <div>
                                    <h3 className="font-semibold text-lg flex items-center gap-2 mb-2">
                                        <Plus className="h-5 w-5 text-green-500" />
                                        Mặt hàng mới ({previewState.newProducts.length})
                                    </h3>
                                    <Accordion type="multiple" defaultValue={previewState.newProducts.map(p => p.name)} className="w-full space-y-2">
                                        {previewState.newProducts.map((product, index) => (
                                            <AccordionItem value={product.name} key={`new-${index}`} className="border rounded-lg shadow-sm bg-green-500/5">
                                                <AccordionTrigger className="p-4 text-base font-semibold hover:no-underline">
                                                    <div className="flex flex-col items-start text-left"><span>{product.name}</span><Badge variant="secondary" className="mt-1 font-normal">{product.category}</Badge></div>
                                                </AccordionTrigger>
                                                <AccordionContent className="p-4 border-t">
                                                    <div className="space-y-2">
                                                        {product.ingredients.map((ing, i) => (
                                                            <div key={i} className="flex items-center gap-2 text-sm p-2 rounded-md bg-background"><CheckCircle className="h-4 w-4 text-green-500" /><span className="font-medium">{ing.name}</span><span className="text-muted-foreground ml-auto">{ing.quantity} {ing.unit}</span></div>
                                                        ))}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                </div>
                            )}

                            {/* Existing Products */}
                            {previewState.existingProducts.length > 0 && (
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="font-semibold text-lg flex items-center gap-2">
                                            <FileUp className="h-5 w-5 text-amber-500" />
                                            Mặt hàng đã tồn tại ({previewState.existingProducts.length})
                                        </h3>
                                        <div className="flex items-center space-x-2">
                                            <Label htmlFor="overwrite-all" className="text-sm">Ghi đè tất cả</Label>
                                            <Switch id="overwrite-all" onCheckedChange={handleToggleAllOverwrite} />
                                        </div>
                                    </div>
                                    <Accordion type="multiple" className="w-full space-y-2">
                                        {previewState.existingProducts.map(({ product, action }, index) => (
                                            <AccordionItem value={product.name} key={`existing-${index}`} className="border rounded-lg shadow-sm bg-amber-500/5">
                                                <div className="flex items-center w-full p-4">
                                                    <AccordionTrigger className="text-base font-semibold hover:no-underline flex-1">
                                                        <div className="flex flex-col items-start text-left"><span>{product.name}</span><Badge variant="secondary" className="mt-1 font-normal">{product.category}</Badge></div>
                                                    </AccordionTrigger>
                                                    <div className="flex items-center gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
                                                        <Label htmlFor={`overwrite-${index}`} className="text-sm font-normal">Ghi đè</Label>
                                                        <Switch id={`overwrite-${index}`} checked={action === 'overwrite'} onCheckedChange={() => handleToggleOverwrite(product.name)} />
                                                    </div>
                                                </div>
                                                <AccordionContent className="p-4 border-t">
                                                    <div className="space-y-2">
                                                        {product.ingredients.map((ing, i) => (
                                                            <div key={i} className="flex items-center gap-2 text-sm p-2 rounded-md bg-background"><CheckCircle className="h-4 w-4 text-green-500" /><span className="font-medium">{ing.name}</span><span className="text-muted-foreground ml-auto">{ing.quantity} {ing.unit}</span></div>
                                                        ))}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                </div>
                            )}

                        </div>
                    </ScrollArea>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowPreview(false)}>Hủy</Button>
                        <Button onClick={handleConfirm} disabled={previewState.newProducts.length === 0 && previewState.existingProducts.every(p => p.action === 'skip')}>
                            <Replace className="mr-2 h-4 w-4" />
                            Lưu thay đổi
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
