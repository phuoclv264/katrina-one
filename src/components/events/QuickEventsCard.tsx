'use client';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Event, AuthUser } from '@/lib/types';
import { Megaphone, ArrowRight } from 'lucide-react';
import { subscribeToActiveEvents } from '@/lib/events-store';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import VoteModal from './VoteModal';
import { useAuth } from '@/hooks/use-auth';

export default function QuickEventsCard() {
    const { user } = useAuth();
    const [activeEvents, setActiveEvents] = useState<Event[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);

    useEffect(() => {
        if (!user) return;
        const unsub = subscribeToActiveEvents(user.role, setActiveEvents);
        return () => unsub();
    }, [user]);

    const handleEventClick = (event: Event) => {
        setSelectedEvent(event);
        setIsVoteModalOpen(true);
    };

    if (!user || activeEvents.length === 0) {
        return null;
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Megaphone className="h-5 w-5 text-primary" />
                        Sự kiện nổi bật
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {activeEvents.map(event => (
                        <div key={event.id} className="p-3 border rounded-lg flex justify-between items-center bg-card hover:bg-muted/50 transition-colors">
                            <div>
                                <p className="font-semibold">{event.title}</p>
                                <p className="text-xs text-muted-foreground">
                                    Kết thúc {formatDistanceToNow(new Date(event.endAt.seconds * 1000), { addSuffix: true, locale: vi })}
                                </p>
                            </div>
                            <Button size="sm" onClick={() => handleEventClick(event)}>
                                Tham gia <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {selectedEvent && user && (
                <VoteModal
                    isOpen={isVoteModalOpen}
                    onClose={() => setIsVoteModalOpen(false)}
                    event={selectedEvent}
                    currentUser={user}
                />
            )}
        </>
    );
}
