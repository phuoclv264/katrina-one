
'use client';
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'nextjs-toploader/app';
import { cn } from '@/lib/utils';
import { getEffectiveStatus, getStatusConfig } from '@/lib/events-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  MoreHorizontal, 
  Plus, 
  Loader2, 
  Edit, 
  Trash2, 
  BarChart2, 
  AlertCircle,
  Calendar,
  Clock,
  Vote,
  Trophy,
  MessageSquare,
  Users,
  Layers,
  Settings2,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger,
  AlertDialogIcon 
} from '@/components/ui/alert-dialog';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { toast } from '@/components/ui/pro-toast';
import { addOrUpdateEvent, deleteEvent, subscribeToAllEvents } from '@/lib/events-store';
import type { Event, ManagedUser } from '@/lib/types';
import EditEventDialog from './_components/edit-event-dialog';
import EventResultsDialog from './_components/event-results-dialog';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore';
import { dataStore } from '@/lib/data-store';


function EventsPageComponent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [events, setEvents] = useState<Event[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null);

  const [isResultsDialogOpen, setIsResultsDialogOpen] = useState(false);
  const [eventForResults, setEventForResults] = useState<Event | null>(null);

  useEffect(() => {
    if (!authLoading && user?.role !== 'Chủ nhà hàng') {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      let eventsLoaded = false;
      let usersLoaded = false;
      const checkLoadingDone = () => {
        if (eventsLoaded && usersLoaded) setIsLoading(false);
      };

      const unsubEvents = subscribeToAllEvents((data) => {
        setEvents(data);
        eventsLoaded = true;
        checkLoadingDone();
      });

      const unsubUsers = dataStore.subscribeToUsers((data) => {
        setUsers(data);
        usersLoaded = true;
        checkLoadingDone();
      });

      return () => {
        unsubEvents();
        unsubUsers();
      };
    }
  }, [user]);

  const handleOpenFormDialog = (event: Event | null) => {
    setEventToEdit(event);
    setIsFormDialogOpen(true);
  };

  const handleOpenResultsDialog = (event: Event) => {
    setEventForResults(event);
    setIsResultsDialogOpen(true);
  };

  const handleSaveEvent = async (data: Omit<Event, 'id'>, id?: string) => {
    setIsProcessing(id || 'new');
    try {
      // Remove any ownerId from incoming data to avoid duplicate keys and ensure the current user is the owner
      const { ownerId: _ownerId, ...eventData } = data as Omit<Event, 'id'>;
      await addOrUpdateEvent({ ...eventData, ownerId: user!.uid }, id);
      toast.success(id ? 'Đã cập nhật sự kiện' : 'Đã tạo sự kiện mới');
      setIsFormDialogOpen(false);
    } catch (error) {
      console.error('Failed to save event:', error);
      toast.error('Lỗi khi lưu sự kiện.');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    setIsProcessing(eventId);
    try {
      await deleteEvent(eventId);
      toast.success('Đã xóa sự kiện thành công.');
    } catch (error) {
      console.error("Failed to delete event:", error);
      toast.error("Không thể xóa sự kiện. Vui lòng thử lại.");
    } finally {
      setIsProcessing(null);
    }
  };

  const formatTimestamp = (ts: Timestamp | Date | string) => {
    if (!ts) return 'N/A';
    const date = (ts as Timestamp).toDate ? (ts as Timestamp).toDate() : new Date(ts as string);
    return format(date, 'dd/MM/yy HH:mm', { locale: vi });
  };

  if (isLoading || authLoading) {
    return <LoadingPage />;
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'vote': return <Vote className="h-5 w-5 text-blue-500" />;
      case 'multi-vote': return <Layers className="h-5 w-5 text-indigo-500" />;
      case 'review': return <MessageSquare className="h-5 w-5 text-emerald-500" />;
      case 'ballot': return <Trophy className="h-5 w-5 text-amber-500" />;
      default: return <Calendar className="h-5 w-5 text-gray-500" />;
    }
  };



  return (
    <div className="container mx-auto p-4 sm:p-6 pb-24 md:pb-8">
      <header className="mb-8 md:flex md:items-end md:justify-between space-y-4 md:space-y-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary mb-1">
            <TrendingUp className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Quản trị hệ thống</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold font-headline tracking-tight">Sự kiện & Bình chọn</h1>
          <p className="text-muted-foreground">Tạo các chương trình thi đua, lấy ý kiến hoặc bình chọn nội bộ.</p>
        </div>
        <Button 
          onClick={() => handleOpenFormDialog(null)}
          className="w-full md:w-auto shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 py-6 px-6"
        >
          <Plus className="mr-2 h-5 w-5" /> Tạo Sự kiện mới
        </Button>
      </header>

      {events.length === 0 ? (
        <Card className="border-dashed border-2 bg-muted/30 py-16">
          <CardContent className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
              <Calendar className="h-10 w-10 text-muted-foreground" />
            </div>
            <div className="max-w-[400px] space-y-2">
              <h3 className="text-xl font-bold">Chưa có sự kiện nào</h3>
              <p className="text-muted-foreground text-sm">Hãy tạo sự kiện đầu tiên để nhân viên có thể tham gia bình chọn và nhận xét.</p>
            </div>
            <Button variant="outline" onClick={() => handleOpenFormDialog(null)} className="mt-4">
              <Plus className="mr-2 h-4 w-4" /> Tạo ngay
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {events.map(event => {
            const effectiveStatus = getEffectiveStatus(event.status, event.endAt);
            const statusCfg = getStatusConfig(effectiveStatus);
            return (
              <Card 
                key={event.id} 
                className={cn(
                  "group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-border/50",
                  isProcessing === event.id && "opacity-60 grayscale cursor-not-allowed"
                )}
              >
                {/* Status indicator bar */}
                <div className={cn("absolute top-0 left-0 w-full h-1", statusCfg.color)} />
                
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className={cn("p-2 rounded-lg", statusCfg.bg)}>
                      {getEventIcon(event.type)}
                    </div>
                    
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full transition-colors hover:bg-muted" disabled={!!isProcessing}>
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onSelect={() => handleOpenResultsDialog(event)}>
                          <BarChart2 className="mr-2 h-4 w-4 text-blue-500" />
                          <span>Xem kết quả</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleOpenFormDialog(event)}>
                          <Edit className="mr-2 h-4 w-4 text-amber-500" />
                          <span>Chỉnh sửa</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <AlertDialog dialogTag="alert-dialog" parentDialogTag="root" variant="destructive">
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Xóa sự kiện</span>
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogIcon icon={Trash2} />
                              <div className="space-y-2 text-center sm:text-left">
                                <AlertDialogTitle>Xóa sự kiện "{event.title}"?</AlertDialogTitle>
                                <AlertDialogDescription>Hành động này sẽ xóa vĩnh viễn sự kiện và tất cả dữ liệu liên quan. Bạn có chắc chắn không?</AlertDialogDescription>
                              </div>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Hủy</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteEvent(event.id)} disabled={isProcessing === event.id}>
                                {isProcessing === event.id ? (
                                  <span className="flex items-center justify-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Đang xóa...
                                  </span>
                                ) : (
                                  'Xóa vĩnh viễn'
                                )}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <div className="space-y-1">
                    <Badge variant="secondary" className="mb-1 uppercase tracking-wider text-[10px] font-bold">
                      {event.type}
                    </Badge>
                    <CardTitle className="text-xl line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                      {event.title}
                    </CardTitle>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4 pb-6">
                  <div className="flex flex-col gap-2 pt-2">
                    <div className="flex items-center text-sm text-muted-foreground gap-2">
                      <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] uppercase font-medium text-muted-foreground/70">Thời gian</span>
                        <span className="font-medium text-foreground">
                          {formatTimestamp(event.startAt)} - {formatTimestamp(event.endAt)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center text-sm text-muted-foreground gap-2">
                      <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                        <Users className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] uppercase font-medium text-muted-foreground/70">Đối tượng</span>
                        <span className="font-medium text-foreground">
                          {event.eligibleRoles.length === 5 ? 'Toàn bộ nhân viên' : event.eligibleRoles.join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <div className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold ring-1 ring-inset",
                      statusCfg.bg,
                      statusCfg.text,
                      "ring-current/20"
                    )}>
                      {statusCfg.label}
                    </div>
                    
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleOpenResultsDialog(event)}
                      className="text-primary hover:bg-primary/5 p-0 h-auto font-bold flex items-center gap-1 group/btn"
                    >
                      Chi tiết <ChevronRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <EditEventDialog
        isOpen={isFormDialogOpen}
        onClose={() => setIsFormDialogOpen(false)}
        eventToEdit={eventToEdit}
        onSave={handleSaveEvent}
        allUsers={users}
        parentDialogTag="root"
      />
      {eventForResults && (
        <EventResultsDialog
          isOpen={isResultsDialogOpen}
          onClose={() => setIsResultsDialogOpen(false)}
          event={eventForResults}
          allUsers={users}
          parentDialogTag='root'
        />
      )}
    </div>
  );
}


export default function EventsPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <EventsPageComponent />
    </Suspense>
  )
}
