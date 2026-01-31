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
import EventParticipationView from "@/components/events/EventParticipationView";
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
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const selectedEvent = useMemo(() => 
    selectedEventId ? events.find(e => e.id === selectedEventId) || null : null
  , [events, selectedEventId]);

  const orderedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const timeA = a.endAt?.toDate?.()?.getTime() || 0;
      const timeB = b.endAt?.toDate?.()?.getTime() || 0;
      return timeA - timeB;
    });
  }, [events]);

  const handleBack = () => {
    setSelectedEventId(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(val) => {
        onOpenChange(val);
        if (!val) setSelectedEventId(null);
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
                        onClick={() => setSelectedEventId(event.id)}
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
                                {event.endAt ? formatDistanceToNow(event.endAt.toDate(), { addSuffix: true, locale: vi }) : "..."}
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

              <div className="flex-1 overflow-y-auto">
                {currentUser && (
                  <EventParticipationView
                    event={selectedEvent}
                    currentUser={currentUser}
                  />
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
