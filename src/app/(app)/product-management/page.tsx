
'use client';
import { useState, useEffect, useMemo } from 'react';
import { dataStore } from '@/lib/data-store';
import type { Product, InventoryItem, ParsedProduct } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Trash2, Plus, Edit } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import ProductEditDialog from './_components/product-edit-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import ProductTools from './_components/product-tools';
import { v4 as uuidv4 } from 'uuid';


type CategorizedProducts = {
    category: string;
    products: Product[];
};

export default function ProductManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [inventoryList, setInventoryList] = useState<InventoryItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'Chủ nhà hàng')) {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    let productsSubscribed = false;
    let inventorySubscribed = false;

    const checkLoadingDone = () => { if (productsSubscribed && inventorySubscribed) setIsLoading(false); };

    const unsubProducts = dataStore.subscribeToProducts((data) => {
        setProducts(data);
        productsSubscribed = true;
        checkLoadingDone();
    });
    const unsubInventory = dataStore.subscribeToInventoryList((items) => {
        setInventoryList(items);
        inventorySubscribed = true;
        checkLoadingDone();
    });
    
    return () => {
        unsubProducts();
        unsubInventory();
    };
  }, [user]);

  const handleUpdateAndSave = (newProducts: Product[]) => {
    setProducts(newProducts);
    dataStore.updateProducts(newProducts).catch(err => {
      toast.error("Không thể lưu thay đổi.");
      console.error(err);
    });
  };

  const handleOpenDialog = (product: Product | null = null) => {
    setProductToEdit(product);
    setIsDialogOpen(true);
  };
  
  const handleSaveProduct = (productData: Product) => {
    if (!products) return;

    const newList = [...products];
    const index = newList.findIndex(p => p.id === productData.id);
    if (index > -1) {
        newList[index] = productData;
    } else {
        newList.push(productData);
    }
    
    handleUpdateAndSave(newList);
    toast.success(`Đã lưu mặt hàng "${productData.name}".`);
    setIsDialogOpen(false);
  };

  const onProductsGenerated = (generatedProducts: ParsedProduct[]) => {
      if (!products) return;
      const newProducts: Product[] = generatedProducts.map(p => ({
          ...p,
          id: `prod_${uuidv4()}`
      }));
      const newList = [...products, ...newProducts];
      handleUpdateAndSave(newList);
  }
  
  const handleDeleteProduct = (productId: string) => {
    if(!products) return;
    const newList = products.filter(p => p.id !== productId);
    handleUpdateAndSave(newList);
    toast.success("Đã xóa mặt hàng.");
  }
  
  const categorizedProducts = useMemo((): CategorizedProducts => {
    if (!products) return [];
    
    const grouped: { [key: string]: Product[] } = {};
    const categoryOrder: string[] = [];

    products.forEach(product => {
        const category = product.category || 'CHƯA PHÂN LOẠI';
        if (!grouped[category]) {
            grouped[category] = [];
            categoryOrder.push(category);
        }
        grouped[category].push(product);
    });

    return categoryOrder
        .sort((a,b) => a.localeCompare(b, 'vi'))
        .map(category => ({ category, products: grouped[category] }));

  }, [products]);


  if (isLoading || authLoading || !products || !inventoryList) {
    return (
      <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">
        <header className="mb-8"><Skeleton className="h-10 w-3/4" /></header>
        <Card><CardContent><Skeleton className="h-96 w-full" /></CardContent></Card>
      </div>
    );
  }

  return (
    <>
    <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold font-headline">Quản lý Mặt hàng & Công thức</h1>
        <p className="text-muted-foreground mt-2">Thêm, sửa, xóa các món nước và công thức pha chế tương ứng.</p>
      </header>

      <ProductTools
        inventoryList={inventoryList}
        onProductsGenerated={onProductsGenerated}
      />
      
       <Card>
        <CardHeader>
            <CardTitle>Danh sách mặt hàng</CardTitle>
            <CardDescription>
                Hiện có {products.length} mặt hàng trong hệ thống.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Button onClick={() => handleOpenDialog()} className="mb-6 w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" /> Thêm mặt hàng mới
            </Button>
            <Accordion type="multiple" defaultValue={categorizedProducts.map(c => c.category)} className="w-full space-y-4">
              {categorizedProducts.map(({ category, products: productList }) => (
                <AccordionItem value={category} key={category} className="border rounded-lg shadow-sm">
                  <AccordionTrigger className="p-4 text-lg font-semibold hover:no-underline">
                    {category} ({productList.length})
                  </AccordionTrigger>
                  <AccordionContent className="p-4 border-t">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {productList.map(product => (
                            <Card key={product.id} className="flex flex-col">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start gap-2">
                                        <CardTitle className="text-base">{product.name}</CardTitle>
                                        <div className="flex">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(product)}><Edit className="h-4 w-4" /></Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Xóa "{product.name}"?</AlertDialogTitle>
                                                        <AlertDialogDescription>Hành động này không thể được hoàn tác. Mặt hàng sẽ bị xóa vĩnh viễn.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteProduct(product.id)}>Xóa</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                                        {(product.ingredients || []).map((ing, index) => {
                                            const inventoryItem = inventoryList.find(i => i.id === ing.inventoryItemId);
                                            return <li key={index}>{inventoryItem?.name || ing.inventoryItemId}: {ing.quantity}{ing.unit}</li>
                                        })}
                                    </ul>
                                </CardContent>
                                {product.note && (
                                    <CardFooter className="pt-2">
                                        <p className="text-xs italic text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-md w-full">
                                            <strong>Ghi chú:</strong> {product.note}
                                        </p>
                                    </CardFooter>
                                )}
                            </Card>
                        ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
        </CardContent>
      </Card>
    </div>
    
    <ProductEditDialog
      isOpen={isDialogOpen}
      onClose={() => setIsDialogOpen(false)}
      onSave={handleSaveProduct}
      productToEdit={productToEdit}
      inventoryList={inventoryList}
    />
    </>
  );
}
