'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogAction,
  DialogCancel,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Combobox } from '@/components/combobox';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Pencil, Check, CreditCard, Search, Building2, User2, Hash, Tag, Info } from 'lucide-react';
import { toast } from '@/components/ui/pro-toast';
import { dataStore } from '@/lib/data-store';
import { VIETQR_BANKS } from '@/lib/vietqr-banks';
import { cn } from '@/lib/utils';
import type { SupplierBankInfo } from '@/lib/types';

type SupplierManagementDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  suppliers: string[];
  parentDialogTag: string;
};

type AccountForm = {
  id?: string;
  accountLabel: string;
  bankId: string;
  bankAccountNumber: string;
  accountName: string;
};

const createEmptyAccountForm = (): AccountForm => ({
  accountLabel: '',
  bankId: '',
  bankAccountNumber: '',
  accountName: '',
});

const createAccountId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `supplier-bank-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
};

export default function SupplierManagementDialog({ isOpen, onClose, suppliers, parentDialogTag }: SupplierManagementDialogProps) {
  const [supplierList, setSupplierList] = useState<string[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [newSupplierName, setNewSupplierName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [bankInfoList, setBankInfoList] = useState<SupplierBankInfo[]>([]);
  const [accountForm, setAccountForm] = useState<AccountForm>(createEmptyAccountForm());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const sortedSuppliers = [...suppliers].sort((a, b) => a.localeCompare(b, 'vi'));
    setSupplierList(sortedSuppliers);
    setSelectedSupplier((prev) => (sortedSuppliers.includes(prev) ? prev : (sortedSuppliers[0] || '')));

    const unsubscribe = dataStore.subscribeToSupplierBankInfo((list) => {
      setBankInfoList(list);
    });

    return () => unsubscribe();
  }, [isOpen, suppliers]);

  const filteredSuppliers = useMemo(() => {
    return supplierList.filter((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [supplierList, searchQuery]);

  const selectedSupplierAccounts = useMemo(() => {
    return bankInfoList
      .filter((item) => item.supplier === selectedSupplier)
      .sort((a, b) => (a.accountLabel || '').localeCompare(b.accountLabel || '', 'vi'));
  }, [bankInfoList, selectedSupplier]);

  const resetForm = () => setAccountForm(createEmptyAccountForm());

  const handleAddSupplier = async () => {
    const supplierName = newSupplierName.trim();
    if (!supplierName) return;
    if (supplierList.some((item) => item.toLowerCase() === supplierName.toLowerCase())) {
      toast.error('Nhà cung cấp đã tồn tại.');
      return;
    }

    setIsSaving(true);
    try {
      const nextList = [...supplierList, supplierName].sort((a, b) => a.localeCompare(b, 'vi'));
      await dataStore.updateSuppliers(nextList);
      setSupplierList(nextList);
      setSelectedSupplier(supplierName);
      setNewSupplierName('');
      toast.success('Đã thêm nhà cung cấp.');
    } catch (error) {
      console.error('Failed to add supplier:', error);
      toast.error('Không thể thêm nhà cung cấp.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSupplier = async (supplier: string) => {
    setIsSaving(true);
    try {
      const nextSuppliers = supplierList.filter((item) => item !== supplier);
      const nextBankInfo = bankInfoList.filter((item) => item.supplier !== supplier);
      await dataStore.updateSuppliers(nextSuppliers);
      await dataStore.updateSupplierBankInfo(nextBankInfo);
      setSupplierList(nextSuppliers);
      setSelectedSupplier((prev) => (prev === supplier ? (nextSuppliers[0] || '') : prev));
      toast.success('Đã xóa nhà cung cấp.');
    } catch (error) {
      console.error('Failed to delete supplier:', error);
      toast.error('Không thể xóa nhà cung cấp.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditAccount = (item: SupplierBankInfo) => {
    setAccountForm({
      id: item.id,
      accountLabel: item.accountLabel || '',
      bankId: item.bankId || '',
      bankAccountNumber: item.bankAccountNumber || '',
      accountName: item.accountName || '',
    });
  };

  const handleSaveAccount = async () => {
    if (!selectedSupplier) {
      toast.error('Vui lòng chọn nhà cung cấp trước.');
      return;
    }

    const bankId = accountForm.bankId.trim();
    const bankAccountNumber = accountForm.bankAccountNumber.trim();
    if (!bankId || !bankAccountNumber) {
      toast.error('Ngân hàng và số tài khoản là bắt buộc.');
      return;
    }

    setIsSaving(true);
    try {
      const payload: SupplierBankInfo = {
        id: accountForm.id || createAccountId(),
        supplier: selectedSupplier,
        bankId,
        bankAccountNumber,
        accountName: accountForm.accountName.trim() || null,
        accountLabel: accountForm.accountLabel.trim() || null,
      };

      const nextList = [...bankInfoList];
      const editIndex = payload.id
        ? nextList.findIndex((item) => item.id === payload.id)
        : -1;

      if (editIndex >= 0) {
        nextList[editIndex] = payload;
      } else {
        nextList.push(payload);
      }

      await dataStore.updateSupplierBankInfo(nextList);
      resetForm();
      toast.success(editIndex >= 0 ? 'Đã cập nhật tài khoản ngân hàng.' : 'Đã thêm tài khoản ngân hàng.');
    } catch (error) {
      console.error('Failed to save supplier account:', error);
      toast.error('Không thể lưu tài khoản ngân hàng.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async (item: SupplierBankInfo) => {
    setIsSaving(true);
    try {
      const nextList = bankInfoList.filter((entry) => {
        if (item.id && entry.id) return entry.id !== item.id;
        return !(entry.supplier === item.supplier && entry.bankId === item.bankId && entry.bankAccountNumber === item.bankAccountNumber);
      });

      await dataStore.updateSupplierBankInfo(nextList);
      if (accountForm.id === item.id) {
        resetForm();
      }
      toast.success('Đã xóa tài khoản ngân hàng.');
    } catch (error) {
      console.error('Failed to delete supplier account:', error);
      toast.error('Không thể xóa tài khoản ngân hàng.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} dialogTag="cashier-supplier-management-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-5xl h-[88vh] p-0 overflow-hidden">
        <DialogHeader iconkey="layout">
          <DialogTitle>Quản lý Nhà cung cấp</DialogTitle>
          <DialogDescription>Thêm nhà cung cấp và quản lý nhiều tài khoản ngân hàng cho từng nhà cung cấp.</DialogDescription>
        </DialogHeader>

        <DialogBody className="p-0 overflow-hidden bg-muted/5">
          <ScrollArea className="h-full">
            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 items-start">
                {/* Sidebar: Supplier Navigation */}
                <div className="flex flex-col gap-4 lg:sticky lg:top-0">
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tìm nhà cung cấp..."
                        className="pl-9 h-11 bg-background border-muted-foreground/20 focus-visible:ring-primary/30"
                      />
                    </div>

                    <div className="rounded-xl border bg-background/50 p-2 space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2">Thêm mới</p>
                      <div className="flex gap-2">
                        <Input
                          value={newSupplierName}
                          onChange={(event) => setNewSupplierName(event.target.value)}
                          onKeyDown={(event) => event.key === 'Enter' && handleAddSupplier()}
                          placeholder="Tên NCC..."
                          className="h-9 text-xs"
                        />
                        <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleAddSupplier} disabled={isSaving || !newSupplierName.trim()}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {filteredSuppliers.length === 0 ? (
                      <p className="text-center py-8 text-xs text-muted-foreground">Không tìm thấy NCC</p>
                    ) : (
                      filteredSuppliers.map((supplier) => (
                        <div key={supplier} className="group relative">
                          <Button
                            type="button"
                            variant="ghost"
                            className={cn(
                              "w-full h-11 justify-start px-3 transition-all relative overflow-hidden",
                              selectedSupplier === supplier 
                                ? "bg-primary/10 text-primary font-bold hover:bg-primary/15" 
                                : "hover:bg-muted/50 text-muted-foreground"
                            )}
                            onClick={() => {
                              setSelectedSupplier(supplier);
                              resetForm();
                            }}
                          >
                            {selectedSupplier === supplier && (
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
                            )}
                            <span className="truncate">{supplier}</span>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="absolute right-1 top-1.5 h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSupplier(supplier);
                            }}
                            disabled={isSaving}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Main Content: Bank Account Management */}
                <div className="flex flex-col bg-background rounded-3xl border shadow-sm overflow-hidden min-h-[600px]">
                  {/* Context Header */}
                  <div className="px-6 py-5 border-b bg-muted/20 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        <h3 className="text-xl font-bold tracking-tight text-foreground">{selectedSupplier || 'Chọn nhà cung cấp'}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium">
                        {selectedSupplier 
                          ? `Quản lý ${selectedSupplierAccounts.length} tài khoản thanh toán cho nhà cung cấp này.`
                          : "Vui lòng chọn hoặc thêm nhà cung cấp từ danh sách bên trái."}
                      </p>
                    </div>
                    {selectedSupplier && (
                      <Badge variant="secondary" className="h-7 px-3 bg-primary/10 text-primary border-primary/20 font-bold">
                        {selectedSupplierAccounts.length} ACCOUNTS
                      </Badge>
                    )}
                  </div>

                  {/* Form & List Container */}
                  <div className="p-6 space-y-8">
                    {selectedSupplier ? (
                      <>
                        {/* Modernized Form */}
                        <div className="relative group">
                          <div className="absolute -inset-1 bg-gradient-to-r from-primary/5 to-primary/10 rounded-2xl blur opacity-75 group-focus-within:opacity-100 transition duration-1000 group-focus-within:duration-200" />
                          <div className="relative rounded-xl border bg-card p-5 space-y-5">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                                <CreditCard className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-bold">{accountForm.id ? 'Cập nhật tài khoản' : 'Thêm tài khoản mới'}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Thông tin thanh toán VietQR</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                              <div className="space-y-2">
                                <Label className="text-[10px] font-bold flex items-center gap-1.5 text-muted-foreground tracking-wider">
                                  <Tag className="h-3 w-3" /> TÊN GỢI NHỚ
                                </Label>
                                <Input
                                  value={accountForm.accountLabel}
                                  onChange={(event) => setAccountForm((prev) => ({ ...prev, accountLabel: event.target.value }))}
                                  placeholder="VD: Tài khoản chính, Vợ chủ nhà..."
                                  className="h-10 bg-muted/40 border-transparent focus:bg-background focus:border-primary/50 transition-all font-medium"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[10px] font-bold flex items-center gap-1.5 text-muted-foreground tracking-wider">
                                  <User2 className="h-3 w-3" /> CHỦ TÀI KHOẢN
                                </Label>
                                <Input
                                  value={accountForm.accountName}
                                  onChange={(event) => setAccountForm((prev) => ({ ...prev, accountName: event.target.value }))}
                                  placeholder="VD: NGUYEN VAN A"
                                  className="h-10 bg-muted/40 border-transparent focus:bg-background focus:border-primary/50 transition-all font-medium uppercase"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[10px] font-bold flex items-center gap-1.5 text-muted-foreground tracking-wider">
                                  <Building2 className="h-3 w-3" /> NGÂN HÀNG
                                </Label>
                                <Combobox
                                  options={VIETQR_BANKS.map((bank) => ({ value: bank.bin, label: `${bank.shortName} - ${bank.name}` }))}
                                  value={accountForm.bankId}
                                  onChange={(value) => setAccountForm((prev) => ({ ...prev, bankId: String(value || '') }))}
                                  placeholder="Chọn ngân hàng"
                                  searchPlaceholder="Tìm theo tên hoặc mã BIN..."
                                  className="h-10 bg-muted/40"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[10px] font-bold flex items-center gap-1.5 text-muted-foreground tracking-wider">
                                  <Hash className="h-3 w-3" /> SỐ TÀI KHOẢN
                                </Label>
                                <Input
                                  value={accountForm.bankAccountNumber}
                                  onChange={(event) => setAccountForm((prev) => ({ ...prev, bankAccountNumber: event.target.value }))}
                                  placeholder="Nhập số tài khoản..."
                                  className="h-10 bg-muted/40 border-transparent focus:bg-background focus:border-primary/50 transition-all font-mono font-medium"
                                />
                              </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                              <Button variant="ghost" onClick={resetForm} disabled={isSaving} className="h-10">
                                Làm lại
                              </Button>
                              <Button 
                                onClick={handleSaveAccount} 
                                disabled={isSaving || !selectedSupplier}
                                className="h-10 px-6 shadow-md shadow-primary/20"
                              >
                                {accountForm.id ? <Check className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                                {accountForm.id ? 'Cập nhật tài khoản' : 'Thêm vào danh sách'}
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Account List */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between group">
                            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                              <Info className="h-3.5 w-3.5 text-primary" /> Danh sách tài khoản đã lưu
                            </h4>
                            <div className="h-px flex-1 bg-muted mx-4 hidden sm:block opacity-50" />
                            <span className="text-[10px] text-muted-foreground font-medium bg-muted/40 px-2 py-0.5 rounded-full">NHẤP ĐỂ CHỈNH SỬA</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-2 gap-4">
                            {selectedSupplierAccounts.length === 0 ? (
                              <div className="col-span-full py-16 flex flex-col items-center justify-center border-2 border-dashed rounded-[2rem] bg-muted/5 opacity-60">
                                <div className="h-16 w-16 rounded-3xl bg-muted/50 flex items-center justify-center mb-4 rotate-12 group-hover:rotate-0 transition-transform">
                                  <CreditCard className="h-8 w-8 text-muted-foreground/50" />
                                </div>
                                <p className="text-sm font-bold text-muted-foreground tracking-tight">Chưa có thông tin thanh toán</p>
                                <p className="text-xs text-muted-foreground/70 mt-1">Vui lòng điền form bên trên để thêm mới.</p>
                              </div>
                            ) : (
                              selectedSupplierAccounts.map((item) => {
                                const bank = VIETQR_BANKS.find((b) => b.bin === item.bankId);
                                return (
                                  <div 
                                    key={item.id || `${item.supplier}-${item.bankId}-${item.bankAccountNumber}`} 
                                    className="group relative rounded-2xl border bg-card hover:bg-muted/10 transition-all p-4 flex gap-4 pr-14 shadow-sm hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20"
                                  >
                                    <div className="h-14 w-14 shrink-0 rounded-xl bg-gradient-to-br from-white to-muted border shadow-sm flex flex-col items-center justify-center text-[10px] font-black overflow-hidden relative">
                                      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                      <span className="text-primary truncate px-1 max-w-full text-center relative z-10 leading-none">
                                        {bank?.shortName || item.bankId}
                                      </span>
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                      <h5 className="font-black text-sm truncate text-foreground/90 tracking-tight">
                                        {item.accountLabel || 'Tài khoản không tên'}
                                      </h5>
                                      <p className="text-lg font-mono font-bold text-foreground/80 tracking-tighter py-0.5">
                                        {item.bankAccountNumber}
                                      </p>
                                      <p className="text-[10px] font-black text-muted-foreground uppercase truncate tracking-widest bg-muted/50 w-fit px-1.5 rounded">
                                        {item.accountName || 'CHƯA RÕ CHỦ TK'}
                                      </p>
                                    </div>
                                    
                                    <div className="absolute right-3 top-0 bottom-0 flex flex-col justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                      <Button 
                                        size="icon" 
                                        variant="secondary" 
                                        className="h-8 w-8 rounded-lg shadow-md border bg-background hover:bg-primary hover:text-primary-foreground transition-colors" 
                                        onClick={() => handleEditAccount(item)} 
                                        disabled={isSaving}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button 
                                        size="icon" 
                                        variant="destructive" 
                                        className="h-8 w-8 rounded-lg shadow-md border"
                                        onClick={() => handleDeleteAccount(item)} 
                                        disabled={isSaving}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="py-24 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                        <div className="h-24 w-24 rounded-[2rem] bg-primary/5 border border-primary/10 flex items-center justify-center mb-8 rotate-12 animate-pulse">
                          <Building2 className="h-12 w-12 text-primary/30" />
                        </div>
                        <h4 className="text-xl font-black mb-3 tracking-tight">BẮT ĐẦU QUẢN LÝ</h4>
                        <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                          Vui lòng chọn một nhà cung cấp từ danh sách bên trái hoặc tạo mới để quản lý thông tin tài khoản thanh toán.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogBody>

        <DialogFooter>
          <DialogCancel onClick={onClose}>Đóng</DialogCancel>
          <DialogAction onClick={onClose}>Xong</DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
