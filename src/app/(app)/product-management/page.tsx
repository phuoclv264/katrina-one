'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { dataStore } from '@/lib/data-store';
import type { Product, InventoryItem, ParsedProduct } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Trash2, Plus, Edit, Check, ArrowUp, ArrowDown, ChevronsDownUp, Wand2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import ProductEditDialog from './_components/product-edit-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import ProductTools from './_components/product-tools';
import { v4 as uuidv4 } from 'uuid';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import isEqual from 'lodash.isequal';


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

  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [isEditMode, setIsEditMode] = useState(false);
  
  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const hasInitializedOpenState = useRef(false);

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

  const handleUpdateAndSave = (newProducts: Product[], showToast = true) => {
    setProducts(newProducts);
    dataStore.updateProducts(newProducts).then(() => {
      if (showToast) {
        toast.success("Thay đổi đã được lưu!");
      }
    }).catch(err => {
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

  const onProductsGenerated = (productsToAdd: ParsedProduct[], productsToUpdate: ParsedProduct[]) => {
      if (!products) return;
      
      const newProducts: Product[] = productsToAdd.map(p => ({
          ...p,
          id: `prod_${uuidv4()}`
      }));
      
      let updatedProductList = [...products, ...newProducts];

      productsToUpdate.forEach(updatedProduct => {
          const index = updatedProductList.findIndex(p => p.name.toLowerCase() === updatedProduct.name.toLowerCase());
          if (index !== -1) {
              const originalId = updatedProductList[index].id;
              updatedProductList[index] = { ...updatedProduct, id: originalId };
          }
      });
      
      handleUpdateAndSave(updatedProductList, false); // Toast is handled in the tool
  }
  
  const handleDeleteProduct = (productId: string) => {
    if(!products) return;
    const newList = products.filter(p => p.id !== productId);
    handleUpdateAndSave(newList);
    toast.success("Đã xóa mặt hàng.");
  }

  const handleToggleSelectProduct = (productId: string, isSelected: boolean) => {
      setSelectedProductIds(prev => {
          const newSet = new Set(prev);
          if (isSelected) {
              newSet.add(productId);
          } else {
              newSet.delete(productId);
          }
          return newSet;
      });
  };

  const handleToggleSelectCategory = (productIdsInCategory: string[], isSelected: boolean) => {
       setSelectedProductIds(prev => {
          const newSet = new Set(prev);
          if (isSelected) {
              productIdsInCategory.forEach(id => newSet.add(id));
          } else {
              productIdsInCategory.forEach(id => newSet.delete(id));
          }
          return newSet;
      });
  }
  
  const handleDeleteSelected = () => {
    if (!products || selectedProductIds.size === 0) return;
    const newList = products.filter(p => !selectedProductIds.has(p.id));
    handleUpdateAndSave(newList);
    toast.success(`Đã xóa ${selectedProductIds.size} mặt hàng.`);
    setSelectedProductIds(new Set());
  }
  
  const handleToggleEditMode = () => {
    if (isEditMode) {
      if (products) {
        dataStore.updateProducts(products).then(() => {
           toast.success("Đã lưu thứ tự mới của các mặt hàng.");
        });
      }
    }
    setIsEditMode(!isEditMode);
  };

  const handleMoveProduct = (productId: string, direction: 'up' | 'down') => {
    if (!products) return;
    const currentIndex = products.findIndex(p => p.id === productId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= products.length) return;

    const newList = [...products];
    const temp = newList[currentIndex];
    newList[currentIndex] = newList[newIndex];
    newList[newIndex] = temp;
    
    // Optimistic update of the local state, will be saved on "Done"
    setProducts(newList);
  };

  const handleMoveCategory = (categoryIndex: number, direction: 'up' | 'down') => {
    if (!products || !categorizedProducts) return;

    const newCategoryOrder = [...categorizedProducts];
    const targetIndex = direction === 'up' ? categoryIndex - 1 : categoryIndex + 1;
    if (targetIndex < 0 || targetIndex >= newCategoryOrder.length) return;

    [newCategoryOrder[categoryIndex], newCategoryOrder[targetIndex]] = [newCategoryOrder[targetIndex], newCategoryOrder[categoryIndex]];

    const newFlatList = newCategoryOrder.flatMap(category => category.products);
    setProducts(newFlatList);
};

  const categorizedProducts = useMemo((): CategorizedProducts[] => {
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
        .map(category => ({ category, products: grouped[category] }));

  }, [products]);

    useEffect(() => {
      if (categorizedProducts.length > 0 && !hasInitializedOpenState.current) {
          setOpenCategories(categorizedProducts.map(c => c.category));
          hasInitializedOpenState.current = true;
      }
  }, [categorizedProducts]);

  const handleToggleAllCategories = () => {
    if (openCategories.length === categorizedProducts.length) {
      setOpenCategories([]);
    } else {
      setOpenCategories(categorizedProducts.map(c => c.category));
    }
  };

  if (isLoading || authLoading || !products || !inventoryList) {
    return (
      <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">
        <header className="mb-8"><Skeleton className="h-10 w-3/4" /></header>
        <Card><CardContent><Skeleton className="h-96 w-full" /></CardContent></Card>
      </div>
    );
  }
  
  const areAllCategoriesOpen = categorizedProducts.length > 0 && openCategories.length === categorizedProducts.length;

  return (
    <>
    <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold font-headline">Quản lý Mặt hàng & Công thức</h1>
        <p className="text-muted-foreground mt-2">Thêm, sửa, xóa các món nước và công thức pha chế tương ứng.</p>
      </header>

      <ProductTools
        inventoryList={inventoryList}
        existingProducts={products}
        onProductsGenerated={onProductsGenerated}
      />
      
       <Card>
        <CardHeader>
            <CardTitle>Danh sách mặt hàng</CardTitle>
            <div className="flex justify-between items-center flex-wrap gap-2">
                <CardDescription>
                    Hiện có {products.length} mặt hàng. {isEditMode && `Đã chọn ${selectedProductIds.size} mặt hàng.`}
                </CardDescription>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleToggleAllCategories}>
                      <ChevronsDownUp className="mr-2 h-4 w-4" />
                      {areAllCategoriesOpen ? 'Thu gọn' : 'Mở rộng'}
                    </Button>
                    <Button onClick={handleToggleEditMode} variant={isEditMode ? 'default' : 'outline'}>
                        {isEditMode ? <Check className="mr-2 h-4 w-4" /> : <Edit className="mr-2 h-4 w-4" />}
                        {isEditMode ? 'Xong' : 'Chỉnh sửa'}
                    </Button>
                    {isEditMode && selectedProductIds.size > 0 && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Xóa ({selectedProductIds.size})
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Xác nhận xóa?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Hành động này sẽ xóa vĩnh viễn {selectedProductIds.size} mặt hàng đã chọn. Bạn có chắc chắn không?
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDeleteSelected}>Xóa</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>
            </div>
        </CardHeader>
        <CardContent>
            <Button onClick={() => handleOpenDialog()} className="mb-6 w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" /> Thêm mặt hàng mới
            </Button>
            <Accordion type="multiple" value={openCategories} onValueChange={setOpenCategories} className="w-full space-y-4">
              {categorizedProducts.map(({ category, products: productList }, categoryIndex) => {
                const productIdsInCategory = productList.map(p => p.id);
                const areAllSelected = productIdsInCategory.every(id => selectedProductIds.has(id));

                return (
                <AccordionItem value={category} key={category} className="border rounded-lg shadow-sm">
                    <div className="flex items-center p-2 bg-muted/30 rounded-t-lg">
                        {isEditMode && (
                          <Checkbox
                              id={`select-all-${category}`}
                              checked={areAllSelected}
                              onCheckedChange={(checked) => handleToggleSelectCategory(productIdsInCategory, !!checked)}
                              className="mx-4"
                          />
                        )}
                        <AccordionTrigger className={cn("p-2 text-lg font-semibold hover:no-underline flex-1", !isEditMode && 'pl-4')}>
                          {category} ({productList.length})
                        </AccordionTrigger>
                        {isEditMode && (
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMoveCategory(categoryIndex, 'up')} disabled={categoryIndex === 0}>
                                    <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMoveCategory(categoryIndex, 'down')} disabled={categoryIndex === categorizedProducts.length - 1}>
                                    <ArrowDown className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                  <AccordionContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {productList.map((product) => {
                            const globalIndex = products.findIndex(p => p.id === product.id);
                            return (
                            <Card key={product.id} className={cn("flex flex-col transition-all", isEditMode && selectedProductIds.has(product.id) && "ring-2 ring-primary border-primary")}>
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex items-start gap-3">
                                            {isEditMode && (
                                              <Checkbox
                                                  id={`select-${product.id}`}
                                                  checked={selectedProductIds.has(product.id)}
                                                  onCheckedChange={(checked) => handleToggleSelectProduct(product.id, !!checked)}
                                                  className="mt-1"
                                              />
                                            )}
                                            <label htmlFor={`select-${product.id}`} className={cn(isEditMode && "cursor-pointer")}>
                                                <CardTitle className="text-base">{product.name}</CardTitle>
                                            </label>
                                        </div>
                                        <div className="flex">
                                             {isEditMode ? (
                                                <div className="flex items-center">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMoveProduct(product.id, 'up')} disabled={globalIndex === 0 || products[globalIndex - 1]?.category !== product.category}>
                                                        <ArrowUp className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMoveProduct(product.id, 'down')} disabled={globalIndex === products.length - 1 || products[globalIndex + 1]?.category !== product.category}>
                                                        <ArrowDown className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <>
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
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                                        {(product.ingredients || []).map((ing, index) => {
                                            const inventoryItem = inventoryList.find(i => i.id === ing.inventoryItemId);
                                            return <li key={index}>{(inventoryItem?.name || ing.name) ?? 'N/A'}: {ing.quantity}{ing.unit}</li>
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
                        )})}
                    </div>
                  </AccordionContent>
                </AccordionItem>
                )
              })}
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
