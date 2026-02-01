
'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import EventParticipationView from './EventParticipationView';
import type { Event, AuthUser } from '@/lib/types';

type VoteModalProps = {
    isOpen: boolean;
    onClose: () => void;
    event: Event;
    currentUser: AuthUser;
    parentDialogTag: string;
};

export default function VoteModal({ isOpen, onClose, event, currentUser, parentDialogTag }: VoteModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose} dialogTag="vote-modal" parentDialogTag={parentDialogTag}>
            <DialogContent className="max-w-md p-0 overflow-hidden flex flex-col bg-card sm:rounded-[2rem] border-none shadow-2xl h-[90vh] sm:h-auto sm:max-h-[85vh]">
                <DialogHeader iconkey="event" variant="premium" className="flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <DialogTitle className="text-xl font-bold leading-tight">{event.title}</DialogTitle>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden">
                    <EventParticipationView 
                        event={event} 
                        currentUser={currentUser} 
                        onSuccess={() => {
                            // Optionally close after a delay or keep open to show success state
                        }} 
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
