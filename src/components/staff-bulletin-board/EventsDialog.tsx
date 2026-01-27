"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogBody } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Megaphone, 
  Clock3, 
  ArrowRight, 
  ChevronLeft, 
  Info, 
  Calendar, 
  ChevronRight,
  Sparkles,
  Trophy,
  Users,
  MessageSquare,
  Vote,
  Bell
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { vi } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import VoteModal from "@/components/events/VoteModal";
import type { AuthUser, Event } from "@/lib/types";

const getEventTypeLabel = (type: string): string => {
  const typeMap: Record<string, string> = {
    training: "Huấn luyện",
    announcement: "Thông báo",
    meeting: "Cuộc họp",
    team_activity: "Hoạt động nhóm",
    survey: "Khảo sát",
    poll: "Bình chọn",
    vote: "Bầu chọn",
    announcement_vote: "Bầu chọn thông báo",
  };
  return typeMap[type] || type;
};

const getEventIcon = (type: string) => {
  switch (type) {
    case "training": return <Trophy className="h-5 w-5" />;
    case "meeting": return <Users className="h-5 w-5" />;
    case "survey":
    case "poll":
    case "vote":
    case "announcement_vote": return <Vote className="h-5 w-5" />;
    case "team_activity": return <Sparkles className="h-5 w-5" />;
    default: return <Bell className="h-5 w-5" />;
  }
};

export type EventsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: Event[];
  currentUser: AuthUser | null;
  joinedEventIds?: Set<string>;
};

export default function EventsDialog({ open, onOpenChange, events, currentUser, joinedEventIds = new Set() }: EventsDialogProps) {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);

  const orderedEvents = useMemo(() => {
    return [...events].sort((a, b) => a.endAt.toDate().getTime() - b.endAt.toDate().getTime());
  }, [events]);

  const handleBack = () => {
    setSelectedEvent(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(val) => {
        onOpenChange(val);
        if (!val) setSelectedEvent(null);
      }} dialogTag="events-list-dialog" parentDialogTag="root">
        <DialogContent className="max-w-lg p-0 overflow-hidden flex flex-col bg-zinc-50 dark:bg-zinc-950">          <DialogTitle className="sr-only">
            {selectedEvent ? selectedEvent.title : "Sự kiện & Thông báo"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Thông tin các sự kiện và hoạt động tại Katrina Coffee
          </DialogDescription>
          {!selectedEvent ? (
            <div className="flex flex-col h-full overflow-hidden">
              <DialogHeader variant="premium" icon={<Megaphone className="h-6 w-6 text-emerald-600 dark:bg-emerald-900/30" />}>
                <div>
                  <DialogTitle className="text-xl sm:text-2xl">Sự kiện & Thông báo</DialogTitle>
                  <DialogDescription className="font-medium opacity-80">
                    {events.length} nội dung quan trọng cần xem
                  </DialogDescription>
                </div>
              </DialogHeader>

              <DialogBody className="space-y-4 pt-6 pb-10">
                {orderedEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="h-20 w-20 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-4">
                      <Megaphone className="h-10 w-10 text-zinc-300 dark:text-zinc-700" />
                    </div>
                    <p className="text-sm font-black text-zinc-400 uppercase tracking-widest">Không có sự kiện</p>
                    <p className="text-xs text-zinc-400 mt-1 italic">Tất cả thông báo đã được xem hết</p>
                  </div>
                ) : (
                  orderedEvents.map((event) => {
                    const isJoined = joinedEventIds.has(event.id);
                    return (
                      <motion.button
                        key={event.id}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedEvent(event)}
                        className={cn(
                          "w-full text-left rounded-[2rem] p-5 transition-all relative border bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md group overflow-hidden",
                          isJoined 
                            ? "border-zinc-200 dark:border-zinc-800 opacity-80" 
                            : "border-emerald-200 dark:border-emerald-800 ring-2 ring-emerald-500/10 shadow-emerald-500/5"
                        )}
                      >
                        <div className="flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className={cn(
                                "h-9 w-9 rounded-2xl flex items-center justify-center transition-all duration-300",
                                isJoined ? "bg-zinc-100/50 dark:bg-zinc-800/50 text-zinc-400" : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 shadow-sm shadow-emerald-500/10"
                              )}>
                                {getEventIcon(event.type)}
                              </div>
                              <span className={cn(
                                "text-[11px] font-black uppercase tracking-[0.12em]",
                                isJoined ? "text-zinc-400/80" : "text-emerald-600"
                              )}>
                                {getEventTypeLabel(event.type)}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              {isJoined ? (
                                <Badge variant="outline" className="h-4.5 px-2 text-[8px] font-black border-zinc-200 text-zinc-400 uppercase tracking-widest rounded-md bg-zinc-50/50 dark:bg-zinc-800/50">Đã xong</Badge>
                              ) : (
                                <Badge className="h-4.5 px-2 text-[8px] font-black bg-emerald-500 text-white border-none uppercase tracking-widest rounded-md animate-pulse whitespace-nowrap shadow-md shadow-emerald-500/20">Cần làm</Badge>
                              )}
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-tight opacity-70">
                                <Clock3 className="h-3.5 w-3.5" />
                                {formatDistanceToNow(event.endAt.toDate(), { addSuffix: true, locale: vi })}
                              </div>
                            </div>
                          </div>

                        <div className="space-y-1.5">
                          <h4 className="text-[15px] font-black leading-tight text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 transition-colors">
                            {event.title}
                          </h4>
                          <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed italic opacity-70">
                            {event.description}
                          </p>
                        </div>
                      </div>

                      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300">
                        <ChevronRight className="h-6 w-6 text-emerald-500" />
                      </div>
                      </motion.button>
                    );
                  })
                )}
              </DialogBody>

              <DialogFooter className="p-6 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
                <Button
                  variant="ghost"
                  className="w-full h-12 rounded-2xl font-black text-zinc-400 hover:text-emerald-600 transition-colors uppercase tracking-[0.2em] text-[11px]"
                  onClick={() => onOpenChange(false)}
                >
                  Đóng cửa sổ
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBack}
                  className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 shrink-0 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition-all"
                >
                  <ChevronLeft className="h-6 w-6" strokeWidth={2.5} />
                </Button>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-black">{selectedEvent.title}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                      {getEventTypeLabel(selectedEvent.type)}
                    </span>
                  </div>
                </div>
              </div>

              <DialogBody className="space-y-8 pt-6 pb-20">
                <div className="space-y-4">
                  <div className="bg-emerald-50/40 dark:bg-emerald-950/20 rounded-[1.5rem] p-6 border border-emerald-100/50 space-y-3 relative overflow-hidden">
                    <div className="absolute -right-6 -top-6 h-24 w-24 bg-emerald-500/5 rounded-full blur-2xl" />
                    <div className="flex items-center gap-2 text-[11px] font-black text-emerald-600 uppercase tracking-widest relative">
                      <MessageSquare className="h-4 w-4" />
                      Chi tiết thông báo
                    </div>
                    <p className="text-sm font-medium leading-relaxed text-zinc-700 dark:text-zinc-200 relative whitespace-pre-wrap">
                      {selectedEvent.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 shadow-sm shrink-0">
                        <Clock3 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">Trạng thái</p>
                        <p className="text-xs font-black text-zinc-700 dark:text-zinc-300">
                          {formatDistanceToNow(selectedEvent.endAt.toDate(), { addSuffix: true, locale: vi })}
                        </p>
                      </div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 shadow-sm shrink-0">
                        <Calendar className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">Hết hạn</p>
                        <p className="text-xs font-black text-zinc-700 dark:text-zinc-300">
                          {format(selectedEvent.endAt.toDate(), "dd/MM/yyyy")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl p-4 border border-amber-100/50 flex gap-3">
                  <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed font-medium">
                    Vui lòng tham gia hoạt động trước thời hạn nêu trên để đảm bảo quyền lợi và trách nhiệm tại Katrina Coffee.
                  </p>
                </div>
              </DialogBody>

              <DialogFooter className="p-6 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 mt-auto">
                <Button
                  size="lg"
                  className="w-full h-14 rounded-[1.5rem] font-black text-sm uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-500/20 active:scale-[0.98] transition-all"
                  onClick={() => setIsVoteModalOpen(true)}
                >
                  Bắt đầu tham gia
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selectedEvent && currentUser && (
        <VoteModal
          isOpen={isVoteModalOpen}
          onClose={() => setIsVoteModalOpen(false)}
          event={selectedEvent}
          currentUser={currentUser}
          parentDialogTag="events-list-dialog"
        />
      )}
    </>
  );
}
