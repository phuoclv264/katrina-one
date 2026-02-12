import React, { useState, useEffect, useRef, useMemo } from 'react';
import { dataStore } from '@/lib/data-store';
import { toast } from '@/components/ui/pro-toast';
import { 
    ArrowLeft, 
    DollarSign, 
    Info, 
    Loader2, 
    User, 
    Wallet,
    Share2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SalaryRecord, ManagedUser, SimpleUser } from '@/lib/types';
import { generateShortName } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';

interface PaymentConfirmationViewProps {
    record: SalaryRecord;
    monthId: string;
    currentUser: SimpleUser | null;
    currentUserRole?: string;
    users: ManagedUser[];
    onRecordUpdated: (userId: string, updates: Partial<SalaryRecord>) => void;
    onCancel: () => void;
    finalTakeHomePay: number;
    violationPenaltyTotals: { paid: number; unpaid: number };
    totalPenalty: number;
}

export const PaymentConfirmationView: React.FC<PaymentConfirmationViewProps> = ({
    record,
    monthId,
    currentUser,
    currentUserRole,
    users,
    onRecordUpdated,
    onCancel,
    finalTakeHomePay,
    violationPenaltyTotals,
    totalPenalty,
}) => {
    const [actualPaidInput, setActualPaidInput] = useState<string>(new Intl.NumberFormat('vi-VN').format(finalTakeHomePay));
    const [actualPaidNumber, setActualPaidNumber] = useState<number | null>(finalTakeHomePay);
    const [qrAmount, setQrAmount] = useState<number>(finalTakeHomePay);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            const amount = actualPaidNumber ?? (actualPaidInput ? Number(actualPaidInput.replace(/\D/g, '')) : NaN);
            setQrAmount((isNaN(amount) || amount === 0) ? finalTakeHomePay : amount);
        }, 600);
        return () => clearTimeout(timeoutId);
    }, [actualPaidNumber, actualPaidInput, finalTakeHomePay]);

    const targetUser = useMemo(() => users.find(u => u.uid === record.userId || u.uid === record.userId), [users, record.userId]);
    
    const qrUrl = useMemo(() => {
        if (!targetUser?.bankId || !targetUser?.bankAccountNumber) return null;
        const amount = qrAmount || finalTakeHomePay;
        const description = `LUONG ${generateShortName(record.userName).toUpperCase()} T${monthId.split('-')[1]}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
        return `https://img.vietqr.io/image/${targetUser.bankId}-${targetUser.bankAccountNumber}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(description)}&accountName=${encodeURIComponent(record.userName)}`;
    }, [targetUser, qrAmount, finalTakeHomePay, record.userName, monthId]);

    const handleConfirmPayment = async () => {
        const amount = actualPaidNumber ?? (actualPaidInput ? Number(actualPaidInput.replace(/\D/g, '')) : NaN);
        if (isNaN(amount) || amount < 0) {
            toast.error('Số tiền không hợp lệ.');
            return;
        }
        setIsUpdating(true);
        const toastId = toast.loading('Đang ghi nhận...');
        try {
            await dataStore.updateSalaryPayment(monthId, record.userId, 'paid', amount);
            onRecordUpdated(record.userId, { 
                paymentStatus: 'paid', 
                paidAt: Timestamp.now() as any,
                actualPaidAmount: amount 
            });
            toast.success(`Đã tất toán cho ${record.userName}`, { id: toastId });
            onCancel();
        } catch (error) {
            toast.error('Lỗi khi cập nhật thanh toán.', { id: toastId });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleShare = async () => {
        if (!qrUrl) return;
        try {
            // Fetch the QR image as a blob so we can share or download the image itself
            const resp = await fetch(qrUrl);
            if (!resp.ok) throw new Error('Không thể tải ảnh QR');
            const blob = await resp.blob();

            const fileName = `LUONG-${generateShortName(record.userName).toUpperCase()}-T${monthId.split('-')[1]}.png`;
            const file = new File([blob], fileName, { type: blob.type });

            // Prefer Web Share API with files if available
            if ((navigator as any).canShare && (navigator as any).canShare({ files: [file] })) {
                await (navigator as any).share({
                    files: [file],
                    title: `Thanh toán - ${record.userName}`,
                    text: `Mã QR thanh toán cho ${record.userName} (T${monthId.split('-')[1]})`,
                });
                toast.success('Đã chia sẻ ảnh mã QR.');
                return;
            }

            // Next, try writing the image to clipboard (modern browsers)
            if (navigator.clipboard && (window as any).ClipboardItem) {
                try {
                    await navigator.clipboard.write([new (window as any).ClipboardItem({ [blob.type]: blob })]);
                    toast.success('Đã sao chép ảnh mã QR vào clipboard.');
                    return;
                } catch (err) {
                    console.warn('Clipboard image write failed', err);
                    // fallthrough to download
                }
            }
        } catch (err) {
            console.error('Chia sẻ mã QR thất bại', err);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white animate-in slide-in-from-right duration-300 overflow-hidden">
            {/* Header */}
            <div className="p-10 flex items-center gap-3 px-4 h-14 border-b flex-shrink-0">
                <Button variant="ghost" size="icon" onClick={onCancel} className="h-9 w-9 text-zinc-500">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex flex-col min-w-0">
                    <h2 className="text-sm font-black text-zinc-900 truncate">Xác nhận trả lương</h2>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{record.userName}</p>
                </div>
            </div>

            <ScrollArea className="flex-grow overflow-y-auto">
                <div className="p-4 space-y-6 pb-24">
                    <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
                        <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 font-medium leading-relaxed">
                            Vui lòng kiểm tra kỹ thông tin trước khi xác nhận. Số tiền thực trả sẽ được ghi nhận vào báo cáo tài chính.
                        </p>
                    </div>

                    {/* QR Code Section */}
                    {qrUrl && (
                        <div className="bg-primary/5 rounded-3xl p-6 flex flex-col items-center gap-6 border-2 border-primary/20 shadow-inner relative overflow-hidden group transition-all">
                            <div className="absolute -top-10 -right-10 opacity-[0.03]">
                                <Wallet className="w-48 h-48" />
                            </div>

                            {/* Share button overlay */}
                            <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
                                <button
                                    type="button"
                                    title="Chia sẻ mã QR"
                                    onClick={handleShare}
                                    className="h-9 px-3 rounded-full bg-white/90 border border-zinc-100 flex items-center gap-2 text-xs font-black text-zinc-700 shadow-sm hover:bg-white transition-colors"
                                >
                                    <Share2 className="w-4 h-4 text-zinc-700" />
                                    <span className="hidden sm:inline">Chia sẻ</span>
                                </button>
                            </div>

                            <div className="relative">
                                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 opacity-50" />
                                <div className="relative p-3 bg-white rounded-3xl border-4 border-white shadow-2xl z-10 overflow-hidden">
                                    <img src={qrUrl} alt="VietQR" className="w-48 h-48 sm:w-56 sm:h-56 object-contain mix-blend-multiply" />
                                </div>
                            </div>
                            <div className="text-center space-y-2 z-10 w-full">
                                <div className="flex flex-col items-center">
                                    <h4 className="font-black text-primary uppercase tracking-[0.15em] text-xs">Quét mã thanh toán nhanh</h4>
                                    <p className="text-[10px] text-zinc-500 font-bold max-w-[200px] leading-relaxed mt-1">
                                        Tài khoản: <span className="text-zinc-900">{targetUser?.bankAccountNumber}</span>
                                    </p>
                                </div>
                                <div className="flex items-center justify-center gap-1.5 bg-white/50 backdrop-blur-sm self-stretch py-2 px-3 rounded-full border border-primary/10 mt-2">
                                    <span className="text-[10px] font-black text-zinc-400">SỐ TIỀN:</span>
                                    <span className="text-sm font-black text-primary">{(qrAmount || finalTakeHomePay).toLocaleString('vi-VN')}đ</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Input Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Số tiền thực trả</Label>
                            <button
                                type="button"
                                onClick={() => {
                                    setActualPaidNumber(finalTakeHomePay);
                                    setActualPaidInput(new Intl.NumberFormat('vi-VN').format(finalTakeHomePay));
                                }}
                                className="text-[10px] font-black text-primary hover:text-primary/70 transition-colors uppercase"
                            >
                                Khôi phục đề xuất
                            </button>
                        </div>
                        <div className="relative group">
                            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-primary/30 font-black text-3xl group-focus-within:text-primary transition-colors">đ</div>
                            <Input
                                type="text"
                                inputMode="numeric"
                                value={actualPaidInput}
                                placeholder="0"
                                className="h-24 text-4xl sm:text-5xl font-black text-right pl-16 pr-8 rounded-[2.5rem] bg-zinc-50 border-2 border-transparent focus-visible:bg-white focus-visible:border-primary/30 focus-visible:ring-primary/5 transition-all shadow-inner"
                                onChange={(e) => {
                                    const raw = e.target.value || '';
                                    const digits = raw.replace(/\D/g, '');
                                    const num = digits === '' ? null : parseInt(digits, 10);
                                    setActualPaidNumber(num);
                                    setActualPaidInput(num == null ? '' : new Intl.NumberFormat('vi-VN').format(num));
                                }}
                                onFocus={(e) => e.currentTarget.select()}
                            />
                        </div>
                    </div>

                    {/* Brief Stats Section */}
                    <div className="bg-zinc-50/50 rounded-3xl p-5 border border-zinc-100 flex flex-col gap-3">
                        <div className="flex justify-between items-center pb-3 border-b border-zinc-100 mb-1">
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-zinc-400" />
                                <span className="text-xs font-bold text-zinc-400 uppercase tracking-tight">Chi tiết nhân viên</span>
                            </div>
                            <span className="text-xs font-black text-primary uppercase tracking-tight">{record.userName}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[9px] font-black text-zinc-400 uppercase">Vai trò</span>
                                <span className="text-xs font-bold text-zinc-700">{record.userRole}</span>
                            </div>
                            <div className="flex flex-col gap-0.5 items-end">
                                <span className="text-[9px] font-black text-zinc-400 uppercase">Giờ làm</span>
                                <span className="text-xs font-bold text-zinc-700">{record.totalWorkingHours.toFixed(1)}h</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[9px] font-black text-zinc-400 uppercase">Lương/giờ tb</span>
                                <span className="text-xs font-bold text-zinc-700">{record.averageHourlyRate.toLocaleString('vi-VN')}đ/h</span>
                            </div>
                            <div className="flex flex-col gap-0.5 items-end">
                                <span className="text-[9px] font-black text-zinc-400 uppercase">Tổng nhận</span>
                                <span className="text-xs font-black text-primary">{finalTakeHomePay.toLocaleString('vi-VN')}đ</span>
                            </div>

                            {totalPenalty > 0 && (
                                <div className="col-span-2 flex justify-between items-center bg-red-50/50 p-2 rounded-xl mt-1">
                                    <span className="text-[9px] font-black text-red-500 uppercase">Tổng phạt</span>
                                    <div className="text-right">
                                        <span className="text-xs font-black text-red-600">{totalPenalty.toLocaleString('vi-VN')}đ</span>
                                        {violationPenaltyTotals.unpaid > 0 && (
                                            <span className="text-[8px] text-red-400 font-bold ml-1.5 tracking-tight uppercase">(Còn nợ)</span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </ScrollArea>

            <div className="p-4 border-t bg-white flex items-center gap-3">
                <Button variant="ghost" className="flex-1 h-12 rounded-2xl font-black text-zinc-500" onClick={onCancel}>
                    Bỏ qua
                </Button>
                <Button className="flex-[2] h-12 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black shadow-xl shadow-primary/25" onClick={handleConfirmPayment} disabled={isUpdating}>
                    {isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : <DollarSign className="w-5 h-5 mr-1" />}
                    Xác nhận trả lương
                </Button>
            </div>
        </div>
    );
};