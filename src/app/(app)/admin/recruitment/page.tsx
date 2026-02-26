'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { dataStore } from '@/lib/data-store';
import { useSearchParams } from 'next/navigation';
import type { JobApplication } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn, advancedSearch } from '@/lib/utils';
import {
  Search,
  Filter,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Briefcase,
  Calendar,
  Phone,
  Mail,
  ChevronRight,
  UserCheck,
  UserMinus,
  Inbox,
  Settings,
  X,
  SlidersHorizontal,
  LayoutGrid,
  List as ListIcon,
  FileText
} from 'lucide-react';
import { toast } from '@/components/ui/pro-toast';
import { useAuth } from '@/hooks/use-auth';
import { useAppNavigation } from '@/contexts/app-navigation-context';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApplicationDetailDialog } from './_components/application-detail-dialog';
import { RecruitmentSettingsDialog } from './_components/recruitment-settings-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { UserAvatar } from '@/components/user-avatar';
import { getQueryParamWithMobileHashFallback } from '@/lib/url-params';

export default function RecruitmentManagementPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-[#f8fafc]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent shadow-lg shadow-blue-200"></div>
      </div>
    }>
      <RecruitmentManagementContent />
    </Suspense>
  );
}

function RecruitmentManagementContent() {
  const { user, loading: authLoading } = useAuth();
  const nav = useAppNavigation();
  const searchParams = useSearchParams();

  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGender, setFilterGender] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPosition, setFilterPosition] = useState<string>('all');
  const [selectedApp, setSelectedApp] = useState<JobApplication | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!authLoading && user?.role !== 'Chủ nhà hàng' && user?.role !== 'Quản lý') {
      nav.replace('/');
    }
  }, [user, authLoading, nav]);

  useEffect(() => {
    const unsubscribe = dataStore.subscribeToJobApplications((apps) => {
      setApplications(apps);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const highlightId = getQueryParamWithMobileHashFallback({
        param: 'highlight',
        searchParams,
        hash: typeof window !== 'undefined' ? window.location.hash : '',
      });

    if (highlightId && applications.length > 0) {
      const app = applications.find(a => a.id === highlightId);
      if (app) {
        setSelectedApp(app);
      }
    }
  }, [applications, searchParams]);

  const stats = useMemo(() => {
    return {
      total: applications.length,
      pending: applications.filter(a => a.status === 'pending').length,
      reviewed: applications.filter(a => a.status === 'reviewed').length,
      hired: applications.filter(a => a.status === 'hired').length,
      rejected: applications.filter(a => a.status === 'rejected').length,
    };
  }, [applications]);

  const handleUpdateStatus = async (id: string, status: JobApplication['status']) => {
    try {
      await dataStore.updateJobApplicationStatus(id, status);
      toast.success('Đã cập nhật trạng thái hồ sơ.');
      if (selectedApp?.id === id) {
        setSelectedApp({ ...selectedApp, status });
      }
    } catch (error) {
      toast.error('Không thể cập nhật trạng thái.');
    }
  };

  const handleUpdateAdminNote = async (id: string, adminNote: string) => {
    try {
      await dataStore.updateJobApplicationAdminNote(id, adminNote);
      if (selectedApp?.id === id) {
        setSelectedApp({ ...selectedApp, adminNote });
      }
    } catch (error) {
      toast.error('Không thể cập nhật ghi chú.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa hồ sơ này?')) return;
    try {
      await dataStore.deleteJobApplication(id);
      toast.success('Đã xóa hồ sơ.');
      if (selectedApp?.id === id) setSelectedApp(null);

      // Remove from selection if deleted
      const newSelected = new Set(selectedIds);
      newSelected.delete(id);
      setSelectedIds(newSelected);
    } catch (error) {
      toast.error('Không thể xóa hồ sơ.');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      await dataStore.bulkDeleteJobApplications(Array.from(selectedIds));
      toast.success(`Đã xóa ${selectedIds.size} hồ sơ.`);
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
    } catch (error) {
      console.error(error);
      toast.error('Có lỗi xảy ra khi xóa hàng loạt.');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = (filteredAppIds: string[]) => {
    if (selectedIds.size === filteredAppIds.length && filteredAppIds.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAppIds));
    }
  };

  // Use advancedSearch for more robust, accent-insensitive, tokenized searching
  let filteredApplications = searchQuery.trim()
    ? advancedSearch(applications, searchQuery, ['fullName', 'phone', 'email'])
    : applications;

  filteredApplications = filteredApplications.filter((app) => {
    const matchesGender = filterGender === 'all' || app.gender === filterGender;
    const matchesStatus = filterStatus === 'all' || app.status === filterStatus;
    const matchesPosition = filterPosition === 'all' || app.position === filterPosition;
    return matchesGender && matchesStatus && matchesPosition;
  });

  const getStatusBadge = (status: JobApplication['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Chờ duyệt</Badge>;
      case 'reviewed':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Đã xem</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Từ chối</Badge>;
      case 'hired':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Đã nhận</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f8fafc]">
      <div className="container mx-auto py-6 md:py-10 px-4 space-y-6 md:space-y-10">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl md:text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
              <span className="p-2 md:p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
                <Inbox className="h-6 w-6 md:h-8 md:w-8 text-white" />
              </span>
              Quản lý Tuyển dụng
            </h1>
            <p className="text-slate-500 font-medium md:text-lg">Theo dõi và quản lý hồ sơ ứng viên hiệu quả hơn.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="rounded-2xl h-12 px-6 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm shadow-sm transition-all gap-2"
              onClick={() => setShowSettings(true)}
            >
              <Settings className="h-4.5 w-4.5 text-slate-400" /> Cài đặt hệ thống
            </Button>
          </div>
        </div>

        {/* Stats Grid - Optimized for all screens */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
            <Card className="border-none shadow-xl shadow-blue-900/5 bg-white overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:scale-110 transition-transform">
                <Inbox className="h-16 w-16 text-blue-500" />
              </div>
              <CardContent className="p-5 md:p-7 relative z-10">
                <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-1">Tổng hồ sơ</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl md:text-4xl font-black text-slate-900">{stats.total}</p>
                  <span className="text-xs font-bold text-slate-400">bản ghi</span>
                </div>
              </CardContent>
              <div className="h-1.5 w-full bg-blue-500" />
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <Card
              className="border-none shadow-xl shadow-yellow-900/5 bg-white overflow-hidden relative group cursor-pointer"
              onClick={() => setFilterStatus('pending')}
            >
              <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:scale-110 transition-transform">
                <Clock className="h-16 w-16 text-yellow-500" />
              </div>
              <CardContent className="p-5 md:p-7 relative z-10">
                <p className="text-sm font-bold text-yellow-600 uppercase tracking-widest mb-1">Đang chờ</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl md:text-4xl font-black text-slate-900">{stats.pending}</p>
                  <span className="text-xs font-bold text-slate-400">cần duyệt</span>
                </div>
              </CardContent>
              <div className="h-1.5 w-full bg-yellow-400" />
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: 0.2 }}>
            <Card
              className="border-none shadow-xl shadow-green-900/5 bg-white overflow-hidden relative group cursor-pointer"
              onClick={() => setFilterStatus('hired')}
            >
              <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:scale-110 transition-transform">
                <UserCheck className="h-16 w-16 text-green-500" />
              </div>
              <CardContent className="p-5 md:p-7 relative z-10">
                <p className="text-sm font-bold text-green-600 uppercase tracking-widest mb-1">Đã tuyển</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl md:text-4xl font-black text-slate-900">{stats.hired}</p>
                  <span className="text-xs font-bold text-slate-400">ứng viên</span>
                </div>
              </CardContent>
              <div className="h-1.5 w-full bg-green-500" />
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: 0.3 }}>
            <Card
              className="border-none shadow-xl shadow-red-900/5 bg-white overflow-hidden relative group cursor-pointer"
              onClick={() => setFilterStatus('rejected')}
            >
              <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:scale-110 transition-transform">
                <UserMinus className="h-16 w-16 text-red-500" />
              </div>
              <CardContent className="p-5 md:p-7 relative z-10">
                <p className="text-sm font-bold text-red-600 uppercase tracking-widest mb-1">Tỉ lệ loại</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl md:text-4xl font-black text-slate-900">
                    {stats.total > 0 ? Math.round((stats.rejected / stats.total) * 100) : 0}%
                  </p>
                  <span className="text-xs font-bold text-slate-400">tổng hồ sơ</span>
                </div>
              </CardContent>
              <div className="h-1.5 w-full bg-red-500" />
            </Card>
          </motion.div>
        </div>

        {/* Search & Filter Bar - Highly Responsive */}
        <div className="flex flex-col gap-4">
          <div className="bg-white p-2 md:p-3 rounded-[2rem] shadow-xl shadow-slate-200 border border-slate-100 flex flex-col md:flex-row items-stretch md:items-center gap-2">
            <div className="relative flex-1 group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <Input
                placeholder="Tìm tên, SĐT, email..."
                className="pl-14 h-14 border-none bg-transparent focus-visible:ring-0 text-lg font-medium placeholder:text-slate-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="h-10 w-[1px] bg-slate-100 hidden md:block" />

            {/* Desktop Filters */}
            <div className="hidden lg:flex items-center gap-2 pr-2">
              <Select value={filterGender} onValueChange={setFilterGender}>
                <SelectTrigger className="h-12 w-40 border-none bg-slate-50/50 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                  <SelectValue placeholder="Giới tính" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-2xl">
                  <SelectItem value="all">Mọi giới tính</SelectItem>
                  <SelectItem value="Nam">Nam</SelectItem>
                  <SelectItem value="Nữ">Nữ</SelectItem>
                  <SelectItem value="Khác">Khác</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterPosition} onValueChange={setFilterPosition}>
                <SelectTrigger className="h-12 w-40 border-none bg-slate-50/50 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                  <SelectValue placeholder="Vị trí" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-2xl">
                  <SelectItem value="all">Tất cả vị trí</SelectItem>
                  <SelectItem value="Phục vụ">Phục vụ</SelectItem>
                  <SelectItem value="Pha chế">Pha chế</SelectItem>
                  <SelectItem value="Quản lý">Quản lý</SelectItem>
                </SelectContent>
              </Select>

              <Tabs value={filterStatus} onValueChange={setFilterStatus}>
                <TabsList className="bg-slate-50 h-12 p-1 rounded-xl">
                  <TabsTrigger value="all" className="rounded-lg px-4 font-bold text-xs uppercase tracking-wider">Tất cả</TabsTrigger>
                  <TabsTrigger value="pending" className="rounded-lg px-4 font-bold text-xs uppercase tracking-wider data-[state=active]:bg-yellow-500 data-[state=active]:text-white">Mới</TabsTrigger>
                  <TabsTrigger value="reviewed" className="rounded-lg px-4 font-bold text-xs uppercase tracking-wider data-[state=active]:bg-blue-600 data-[state=active]:text-white">Xem</TabsTrigger>
                  <TabsTrigger value="hired" className="rounded-lg px-4 font-bold text-xs uppercase tracking-wider data-[state=active]:bg-green-600 data-[state=active]:text-white">Nhận</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Mobile/Tablet Filter Button */}
            <div className="lg:hidden flex items-center gap-2 pb-2 md:pb-0 px-2">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="flex-1 h-14 rounded-2xl gap-2 font-bold text-slate-600 border-slate-200">
                    <SlidersHorizontal className="h-5 w-5" />
                    Bộ lọc & Trạng thái
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-[2.5rem] p-6 h-[70vh]">
                  <SheetHeader>
                    <SheetTitle className="text-2xl font-black text-left mb-6">Tùy chọn hiển thị</SheetTitle>
                  </SheetHeader>
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <p className="text-sm font-black uppercase tracking-widest text-slate-400">Trạng thái hồ sơ</p>
                      <div className="grid grid-cols-2 gap-2">
                        {['all', 'pending', 'reviewed', 'hired', 'rejected'].map((s) => (
                          <Button
                            key={s}
                            variant={filterStatus === s ? 'default' : 'outline'}
                            className={`h-12 rounded-xl font-bold ${filterStatus === s
                                ? s === 'pending' ? 'bg-yellow-500 hover:bg-yellow-600' :
                                  s === 'reviewed' ? 'bg-blue-600 hover:bg-blue-700' :
                                    s === 'hired' ? 'bg-green-600 hover:bg-green-700' :
                                      s === 'rejected' ? 'bg-red-600 hover:bg-red-700' : ''
                                : ''
                              }`}
                            onClick={() => setFilterStatus(s)}
                          >
                            {s === 'all' ? 'Tất cả' :
                              s === 'pending' ? 'Chờ duyệt' :
                                s === 'reviewed' ? 'Đã xem' :
                                  s === 'hired' ? 'Đã nhận' : 'Từ chối'}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <p className="text-sm font-black uppercase tracking-widest text-slate-400">Vị trí</p>
                        <Select value={filterPosition} onValueChange={setFilterPosition}>
                          <SelectTrigger className="h-14 rounded-xl font-bold bg-slate-50 border-none">
                            <SelectValue placeholder="Vị trí" />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-none">
                            <SelectItem value="all">Tất cả vị trí</SelectItem>
                            <SelectItem value="Phục vụ">Phục vụ</SelectItem>
                            <SelectItem value="Pha chế">Pha chế</SelectItem>
                            <SelectItem value="Quản lý">Quản lý</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-4">
                        <p className="text-sm font-black uppercase tracking-widest text-slate-400">Giới tính</p>
                        <Select value={filterGender} onValueChange={setFilterGender}>
                          <SelectTrigger className="h-14 rounded-xl font-bold bg-slate-50 border-none">
                            <SelectValue placeholder="Giới tính" />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-none">
                            <SelectItem value="all">Mọi giới tính</SelectItem>
                            <SelectItem value="Nam">Nam</SelectItem>
                            <SelectItem value="Nữ">Nữ</SelectItem>
                            <SelectItem value="Khác">Khác</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="sticky top-16 md:top-[72px] z-40 left-0 right-0 max-w-2xl mx-auto px-4"
            >
              <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-3 md:p-4 shadow-2xl flex items-center justify-between gap-2 md:gap-4">
                <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
                  <div className="bg-blue-500 text-white h-6 w-6 md:h-7 md:w-7 rounded-full flex items-center justify-center text-[10px] md:text-xs font-bold ring-4 ring-blue-500/20 shrink-0">
                    {selectedIds.size}
                  </div>
                  <span className="text-[11px] md:text-sm font-medium text-slate-200 truncate">
                    <span className="hidden sm:inline">hồ sơ </span>đã chọn
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 md:h-8 px-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-[10px] md:text-xs shrink-0"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Bỏ chọn
                  </Button>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-9 md:h-10 px-3 md:px-5 rounded-xl text-[10px] md:text-xs font-bold shadow-lg shadow-red-500/20 active:scale-95 transition-transform"
                    onClick={() => setShowBulkDeleteConfirm(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5 md:mr-2" />
                    <span className="hidden sm:inline">Xóa <span className="hidden md:inline">hàng loạt</span></span>
                    <span className="sm:hidden ml-1">Xóa</span>
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Card View - Enhanced Data for Small Screens */}
        <div className="md:hidden space-y-4">
          <AnimatePresence mode="popLayout">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-44 bg-slate-100 animate-pulse rounded-3xl" />
              ))
            ) : filteredApplications.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                <div className="bg-slate-50 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Inbox className="h-10 w-10 text-slate-300" />
                </div>
                <p className="text-slate-500 font-bold text-lg">Không tìm thấy ứng viên</p>
                <p className="text-slate-400 text-sm">Hãy thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
              </div>
            ) : (
              filteredApplications.map((app) => (
                <motion.div
                  key={app.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <Card
                    className={`border-none shadow-xl shadow-slate-200/50 transition-all rounded-3xl overflow-hidden relative ${selectedIds.has(app.id) ? 'ring-4 ring-blue-500/20 bg-blue-50/10' : 'bg-white'
                      }`}
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedIds.has(app.id)}
                            onCheckedChange={() => toggleSelect(app.id)}
                            className="h-6 w-6 rounded-lg data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          />
                          <div
                            className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 overflow-hidden"
                            onClick={() => setSelectedApp(app)}
                          >
                            {app.photoUrl ? (
                              <UserAvatar avatarUrl={app.photoUrl} nameOverride={app.fullName} className="w-full h-full object-cover" />
                            ) : (
                              <User className="h-6 w-6" />
                            )}
                          </div>
                          <div onClick={() => setSelectedApp(app)}>
                            <h3 className="font-black text-slate-900 leading-tight flex items-center gap-2">
                              {app.fullName}
                              {app.adminNote && (
                                <FileText className="h-4 w-4 text-rose-500 shrink-0" />
                              )}
                            </h3>
                            <p className="text-xs text-slate-400 font-bold mt-0.5">{app.gender}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-4" onClick={() => setSelectedApp(app)}>
                        <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100/50">
                          <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">Vị trí</p>
                          <p className="text-sm font-bold text-blue-700">{app.position}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-2xl">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Năm sinh</p>
                          <p className="text-sm font-bold text-slate-700">{app.birthYear}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-2xl">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Liên hệ</p>
                          <p className="text-sm font-bold text-slate-700 truncate">{app.phone}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-2xl">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Ngày gửi</p>
                          <p className="text-sm font-bold text-slate-700">
                            {format(new Date(app.createdAt), 'dd/MM/yyyy', { locale: vi })}
                          </p>
                        </div>
                      </div>

                      <div className={cn(
                        "mt-1 mb-4 py-2.5 px-4 rounded-2xl flex items-center justify-center gap-2 border shadow-sm transition-all",
                        app.status === 'pending' ? "bg-amber-50 border-amber-100/50 text-amber-700 shadow-amber-200/20" :
                          app.status === 'reviewed' ? "bg-blue-50 border-blue-100/50 text-blue-700 shadow-blue-200/20" :
                            app.status === 'hired' ? "bg-emerald-50 border-emerald-100/50 text-emerald-700 shadow-emerald-200/20" :
                              "bg-rose-50 border-rose-100/50 text-rose-700 shadow-rose-200/20"
                      )}>
                        {app.status === 'pending' && <Clock className="h-3.5 w-3.5" />}
                        {app.status === 'reviewed' && <Inbox className="h-3.5 w-3.5" />}
                        {app.status === 'hired' && <CheckCircle className="h-3.5 w-3.5" />}
                        {app.status === 'rejected' && <XCircle className="h-3.5 w-3.5" />}
                        <span className="text-[10px] font-black uppercase tracking-[0.1em]">
                          {app.status === 'pending' ? 'Hồ sơ mới - Đang chờ duyệt' :
                            app.status === 'reviewed' ? 'Đã xem thông tin ứng viên' :
                              app.status === 'hired' ? 'Đã trúng tuyển & Nhận việc' : 'Hồ sơ không đáp ứng yêu cầu'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-xl bg-green-50 text-green-600 hover:bg-green-100"
                            onClick={() => handleUpdateStatus(app.id, 'hired')}
                          >
                            <CheckCircle className="h-5 w-5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-xl bg-red-50 text-red-600 hover:bg-red-100"
                            onClick={() => handleUpdateStatus(app.id, 'rejected')}
                          >
                            <XCircle className="h-5 w-5" />
                          </Button>
                        </div>
                        <Button
                          variant="ghost"
                          className="font-black text-blue-600 gap-1 pr-0"
                          onClick={() => setSelectedApp(app)}
                        >
                          Chi tiết <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Desktop Table View - Polished & Responsive */}
        <div className="hidden md:block">
          <Card className="border-none shadow-2xl shadow-slate-200 bg-white rounded-[2.5rem] overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/50 border-b border-slate-100">
                  <TableRow className="hover:bg-transparent h-16">
                    <TableHead className="w-[80px] text-center">
                      <Checkbox
                        checked={selectedIds.size === filteredApplications.length && filteredApplications.length > 0}
                        onCheckedChange={() => toggleSelectAll(filteredApplications.map(a => a.id))}
                        className="h-5 w-5 rounded-lg border-slate-300"
                      />
                    </TableHead>
                    <TableHead className="font-black text-slate-400 uppercase tracking-widest text-[11px] py-4">Ứng viên</TableHead>
                    <TableHead className="font-black text-slate-400 uppercase tracking-widest text-[11px]">Thông tin</TableHead>
                    <TableHead className="font-black text-slate-400 uppercase tracking-widest text-[11px] text-center">Giới tính</TableHead>
                    <TableHead className="font-black text-slate-400 uppercase tracking-widest text-[11px]">Trạng thái</TableHead>
                    <TableHead className="font-black text-slate-400 uppercase tracking-widest text-[11px] text-right">Ngày gửi</TableHead>
                    <TableHead className="font-black text-slate-400 uppercase tracking-widest text-[11px] text-right pr-10">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence mode="popLayout">
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i} className="h-20 border-b border-slate-50">
                          <TableCell colSpan={7} className="px-10">
                            <div className="h-8 bg-slate-50 animate-pulse rounded-xl" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      filteredApplications.map((app) => (
                        <TableRow
                          key={app.id}
                          className={`h-22 group transition-all cursor-pointer border-b border-slate-50 ${selectedIds.has(app.id) ? 'bg-blue-50/30' : 'hover:bg-slate-50/50'
                            }`}
                          onClick={() => setSelectedApp(app)}
                        >
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(app.id)}
                              onCheckedChange={() => toggleSelect(app.id)}
                              className="h-5 w-5 rounded-lg border-slate-300 data-[state=checked]:bg-blue-600"
                            />
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex items-center gap-4">
                              <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-white group-hover:shadow-md transition-all overflow-hidden">
                                {app.photoUrl ? (
                                  <img src={app.photoUrl} alt={app.fullName} className="w-full h-full object-cover" />
                                ) : (
                                  <User className="h-6 w-6" />
                                )}
                              </div>
                              <div>
                                <h4 className="font-black text-slate-900 text-lg flex items-center gap-2">
                                  {app.fullName}
                                  {app.adminNote && (
                                    <FileText className="h-4 w-4 text-rose-500 shrink-0" />
                                  )}
                                </h4>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{app.phone}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="bg-blue-50 text-blue-600 font-black text-[10px] uppercase tracking-wider px-2 py-0 border-none">
                                  {app.position}
                                </Badge>
                              </div>
                              <span className="text-xs font-bold text-slate-500">Năm sinh: {app.birthYear}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-bold text-slate-600">
                            {app.gender}
                          </TableCell>
                          <TableCell>{getStatusBadge(app.status)}</TableCell>
                          <TableCell className="text-right font-bold text-slate-500">
                            {format(new Date(app.createdAt), 'dd/MM/yyyy', { locale: vi })}
                          </TableCell>
                          <TableCell className="text-right pr-8" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-xl bg-green-50/50 text-green-600 hover:bg-green-100 border border-green-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all"
                                onClick={() => handleUpdateStatus(app.id, 'hired')}
                              >
                                <CheckCircle className="h-5 w-5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-xl bg-red-50/50 text-red-600 hover:bg-red-100 border border-red-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all"
                                onClick={() => handleUpdateStatus(app.id, 'rejected')}
                              >
                                <XCircle className="h-5 w-5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-xl bg-slate-50/50 text-slate-400 hover:bg-slate-100 border border-slate-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all"
                                onClick={() => handleDelete(app.id)}
                              >
                                <Trash2 className="h-5 w-5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      <ApplicationDetailDialog
        isOpen={!!selectedApp}
        application={selectedApp}
        onClose={() => setSelectedApp(null)}
        onUpdateStatus={handleUpdateStatus}
        onUpdateAdminNote={handleUpdateAdminNote}
        getStatusBadge={getStatusBadge}
        onDelete={handleDelete}
      />

      <RecruitmentSettingsDialog
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa hàng loạt?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn đang chuẩn bị xóa <strong>{selectedIds.size}</strong> hồ sơ ứng tuyển.
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl border-slate-200">Hủy bỏ</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold"
              disabled={isDeleting}
            >
              {isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
