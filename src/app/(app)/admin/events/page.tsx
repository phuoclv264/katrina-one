
'use client';
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'nextjs-toploader/app';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Plus, Loader2, Edit, Trash2, BarChart2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
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

  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">Quản lý Sự kiện</h1>
          <p className="text-muted-foreground mt-2">Tạo và quản lý các sự kiện bình chọn, đánh giá, và rút thăm trúng thưởng.</p>
        </div>
        <Button onClick={() => handleOpenFormDialog(null)}>
          <Plus className="mr-2 h-4 w-4" /> Tạo Sự kiện mới
        </Button>
      </header>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tiêu đề</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Thời gian</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24">Chưa có sự kiện nào.</TableCell></TableRow>
              ) : (
                events.map(event => (
                  <TableRow key={event.id} className={isProcessing === event.id ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">{event.title}</TableCell>
                    <TableCell><Badge variant="outline">{event.type}</Badge></TableCell>
                    <TableCell><Badge variant={event.status === 'active' ? 'default' : (event.status === 'closed' ? 'destructive' : 'secondary')}>{event.status}</Badge></TableCell>
                    <TableCell>
                      {formatTimestamp(event.startAt)} - {formatTimestamp(event.endAt)}
                    </TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" disabled={!!isProcessing}><MoreHorizontal className="h-4 w-4"/></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => handleOpenResultsDialog(event)}><BarChart2 className="mr-2 h-4 w-4"/>Xem kết quả</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenFormDialog(event)}><Edit className="mr-2 h-4 w-4"/>Sửa</DropdownMenuItem>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Xóa</DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Xóa sự kiện "{event.title}"?</AlertDialogTitle>
                                            <AlertDialogDescription>Hành động này sẽ xóa vĩnh viễn sự kiện và tất cả dữ liệu liên quan (phiếu bầu, bình luận...).</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Hủy</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteEvent(event.id)}>Xóa</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <EditEventDialog
        isOpen={isFormDialogOpen}
        onClose={() => setIsFormDialogOpen(false)}
        eventToEdit={eventToEdit}
        onSave={handleSaveEvent}
        allUsers={users}
      />
      {eventForResults && (
        <EventResultsDialog
          isOpen={isResultsDialogOpen}
          onClose={() => setIsResultsDialogOpen(false)}
          event={eventForResults}
          allUsers={users}
        />
      )}
    </div>
  );
}


export default function EventsPage() {
    return (
        <Suspense fallback={<LoadingPage/>}>
            <EventsPageComponent />
        </Suspense>
    )
}
