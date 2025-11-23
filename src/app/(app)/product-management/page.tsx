'use client';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { dataStore } from '@/lib/data-store';
import type { Product, InventoryItem, ParsedProduct, GlobalUnit } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Trash2, Plus, Edit, Check, ArrowUp, ArrowDown, ChevronsDownUp, Wand2, Download, AlertTriangle, Box, Beaker, Search, Filter } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { useAuth } from '@/hooks/use-auth';
import { useAppRouter } from '@/hooks/use-app-router';import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import ProductEditDialog from './_components/product-edit-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import ProductTools from './_components/product-tools';
import { v4 as uuidv4 } from 'uuid';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import isEqual from 'lodash.isequal';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


type CategorizedProducts = {
    category: string;
    products: Product[];
};

export default function ProductManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useAppRouter();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [inventoryList, setInventoryList] = useState<InventoryItem[] | null>(null);
  const [globalUnits, setGlobalUnits] = useState<GlobalUnit[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);

  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [isEditMode, setIsEditMode] = useState(false);
  
  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const hasInitializedOpenState = useRef(false);

  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | 'all'>('all');

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const handleDataRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'Chủ nhà hàng')) {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    let productsSubscribed = false;
    let inventorySubscribed = false;
    let unitsSubscribed = false;

    const checkLoadingDone = () => { if (productsSubscribed && inventorySubscribed && unitsSubscribed) setIsLoading(false); };

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
     const unsubUnits = dataStore.subscribeToGlobalUnits((units) => {
        setGlobalUnits(units);
        unitsSubscribed = true;
        checkLoadingDone();
    });
    
    return () => {
        unsubProducts();
        unsubInventory();
        unsubUnits();
    };
  }, [user, refreshTrigger]);

  useDataRefresher(handleDataRefresh);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    let list = products;
    if (filter) {
      list = list.filter(product => product.name.toLowerCase().includes(filter.toLowerCase()));
    }
    if (categoryFilter !== 'all') {
      list = list.filter(product => product.category === categoryFilter);
    }
    return list;
  }, [products, filter, categoryFilter]);

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
          id: `prod_${uuidv4()}`,
          isIngredient: p.isIngredient ?? false,
          yield: p.yield ?? { quantity: 1, unit: 'phần' },
          note: p.note ?? '',
          ingredients: p.ingredients || [],
      }));
      
      let updatedProductList = [...products, ...newProducts];

      productsToUpdate.forEach(updatedProduct => {
          const index = updatedProductList.findIndex(p => p.name.toLowerCase() === updatedProduct.name.toLowerCase());
          if (index !== -1) {
              const originalId = updatedProductList[index].id;
              updatedProductList[index] = { 
                ...updatedProduct, 
                id: originalId,
                isIngredient: updatedProduct.isIngredient ?? false,
                yield: updatedProduct.yield ?? { quantity: 1, unit: 'phần' },
                note: updatedProduct.note ?? '',
                ingredients: updatedProduct.ingredients || [],
              };
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
  
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleToggleEditMode = () => {
    const newSortState = !isEditMode;
    if (newSortState === false && hasUnsavedChanges && products) {
      dataStore.updateProducts(products).then(() => {
        toast.success("Đã lưu thứ tự mới của các mặt hàng.");
        setHasUnsavedChanges(false);
      });
    }
    setIsEditMode(newSortState);
  };
  
  const handleMoveProduct = (productId: string, direction: 'up' | 'down') => {
    if (!products) return;
    const currentIndex = products.findIndex(p => p.id === productId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= products.length) return;
    
    // Prevent moving across categories
    if (products[currentIndex].category !== products[newIndex].category) {
        toast.error("Chỉ có thể sắp xếp các mục trong cùng một danh mục.");
        return;
    }

    const newList = [...products];
    [newList[currentIndex], newList[newIndex]] = [newList[newIndex], newList[currentIndex]];
    
    setProducts(newList);
    setHasUnsavedChanges(true);
  };

  const handleMoveCategory = (categoryIndex: number, direction: 'up' | 'down') => {
      if (!products || !categorizedProducts) return;

      const newCategoryOrder = [...categorizedProducts];
      const targetIndex = direction === 'up' ? categoryIndex - 1 : categoryIndex + 1;
      if (targetIndex < 0 || targetIndex >= newCategoryOrder.length) return;

      [newCategoryOrder[categoryIndex], newCategoryOrder[targetIndex]] = [newCategoryOrder[targetIndex], newCategoryOrder[categoryIndex]];

      const newFlatList = newCategoryOrder.flatMap(category => category.products);
      setProducts(newFlatList);
      setHasUnsavedChanges(true);
  };

  const categorizedProducts = useMemo((): CategorizedProducts[] => {
    if (!filteredProducts) return [];
    
    const categoryMap = new Map<string, Product[]>();
    
    filteredProducts.forEach(product => {
        const category = product.category || 'CHƯA PHÂN LOẠI';
        if (!categoryMap.has(category)) {
            categoryMap.set(category, []);
        }
        categoryMap.get(category)!.push(product);
    });

    return Array.from(categoryMap.keys()).map(category => ({
        category,
        products: categoryMap.get(category)!
    }));

  }, [filteredProducts]);

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
  
    const handleInventoryItemUpdate = (updatedItem: InventoryItem) => {
        if (!inventoryList) return;
        const newList = inventoryList.map(item => item.id === updatedItem.id ? updatedItem : item);
        setInventoryList(newList);
        dataStore.updateInventoryList(newList);
  };

  const handleGlobalUnitsChange = (newUnits: GlobalUnit[]) => {
    setGlobalUnits(newUnits);
    dataStore.updateGlobalUnits(newUnits);
  };

  const handleExport = () => {
    if (!products) return;
    const textToCopy = products.map((p, index) => {
        const ingredients = (p.ingredients || [])
            .map(ing => {
                const item = ing.inventoryItemId
                    ? inventoryList?.find(i => i.id === ing.inventoryItemId)
                    : products.find(prod => prod.id === ing.productId);
                const name = item?.name || ing.name || 'Không rõ';
                return `  - ${ing.quantity} ${ing.unit} ${name}`;
            }).join('\n');
        
        let productText = `${index + 1}. ${p.name.toUpperCase()} (${p.category.toUpperCase()})\n${ingredients}`;
        if (p.note) productText += `\n  Note: ${p.note}`;
        if (p.yield && (p.yield.quantity !== 1 || p.yield.unit !== 'phần')) productText += `\n  Yield: ${p.yield.quantity} ${p.yield.unit}`;
        if (p.isIngredient) productText += `\n  Is Ingredient: true`;
        return productText;
    }).join('\n\n');

    navigator.clipboard.writeText(textToCopy).then(() => {
        toast.success("Đã sao chép toàn bộ công thức vào bộ nhớ tạm.");
    }).catch(() => {
        toast.error("Không thể sao chép.");
    });
  };

  const allCategories = useMemo(() => {
    if (!products) return [];
    return [...new Set(products.map(product => product.category))].sort();
  }, [products]);


  if (isLoading || authLoading || !products || !inventoryList || !globalUnits) {
    return <LoadingPage />;
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <CardDescription>
                    Hiển thị {filteredProducts.length} / {products.length} mặt hàng.
                </CardDescription>
                <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={handleExport}><Download className="mr-2 h-4 w-4"/>Xuất</Button>
                    <Button variant="outline" size="sm" onClick={handleToggleAllCategories}>
                      <ChevronsDownUp className="mr-2 h-4 w-4" />
                      {areAllCategoriesOpen ? 'Thu gọn' : 'Mở rộng'}
                    </Button>
                    <Button onClick={handleToggleEditMode} variant={isEditMode ? 'default' : 'outline'} size="sm">
                        {isEditMode ? <Check className="mr-2 h-4 w-4" /> : <Edit className="mr-2 h-4 w-4" />}
                        {isEditMode ? 'Xong' : 'Sửa'}
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
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Tìm theo tên mặt hàng..." className="pl-8" value={filter} onChange={(e) => setFilter(e.target.value)} />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <SelectValue placeholder="Lọc theo nhóm..." />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả danh mục</SelectItem>
                  {allCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                             <Dialog key={product.id} onOpenChange={(open) => { if (open) { handleOpenDialog(product) } else { setIsDialogOpen(false) }}}>
                                <DialogTrigger asChild>
                                    <Card className={cn("flex flex-col transition-all h-full", 
                                        isEditMode ? "cursor-default" : "cursor-pointer hover:bg-muted/50",
                                        isEditMode && selectedProductIds.has(product.id) && "ring-2 ring-primary border-primary"
                                    )}
                                    onClick={() => !isEditMode && handleOpenDialog(product)}
                                    >
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="flex items-start gap-3">
                                                    {isEditMode && (
                                                    <Checkbox
                                                        id={`select-${product.id}`}
                                                        checked={selectedProductIds.has(product.id)}
                                                        onCheckedChange={(checked) => {
                                                            const event = window.event as MouseEvent;
                                                            event?.stopPropagation();
                                                            handleToggleSelectProduct(product.id, !!checked);
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="mt-1"
                                                    />
                                                    )}
                                                    <label htmlFor={`select-${product.id}`} className={cn(isEditMode && "cursor-pointer", !isEditMode && "cursor-default")}>
                                                        <CardTitle className="text-base">{product.name}</CardTitle>
                                                    </label>
                                                </div>
                                                <div className="flex">
                                                    {isEditMode ? (
                                                        <div className="flex items-center">
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleMoveProduct(product.id, 'up')}} disabled={globalIndex === 0 || products[globalIndex - 1]?.category !== product.category}>
                                                                <ArrowUp className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleMoveProduct(product.id, 'down')}} disabled={globalIndex === products.length - 1 || products[globalIndex + 1]?.category !== product.category}>
                                                                <ArrowDown className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => e.stopPropagation()}><Trash2 className="h-4 w-4" /></Button>
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
                                                    )}
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="flex-grow">
                                            <ul className="text-sm text-muted-foreground list-none pl-0 space-y-1">
                                                {(product.ingredients || []).map((ing, index) => {
                                                    const item = ing.inventoryItemId
                                                    ? inventoryList.find(i => i.id === ing.inventoryItemId)
                                                    : products.find(p => p.id === ing.productId);
                                                    const isSubProduct = !!ing.productId;
                                                    const isValid = !!item;
                                                    return (
                                                    <li key={index} className={cn("flex items-start gap-2", isSubProduct && 'font-semibold text-primary/80')}>
                                                        {isValid ? (
                                                        isSubProduct ? <Beaker className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" /> : <Box className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                                                        ) : (
                                                        <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                                                        )}
                                                        {item?.name || 'Nguyên liệu không xác định'}: {ing.quantity}{ing.unit}
                                                    </li>
                                                    );
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
                                </DialogTrigger>
                             </Dialog>
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
      allProducts={products}
      onInventoryItemUpdate={handleInventoryItemUpdate}
      globalUnits={globalUnits}
      onGlobalUnitsChange={handleGlobalUnitsChange}
      canManageUnits={user?.role === 'Chủ nhà hàng'}
    />
    </>
  );
}
