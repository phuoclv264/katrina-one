
'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquareWarning } from 'lucide-react';

type SubmissionNotesSectionProps = {
    initialNotes: string;
    onNotesChange: (notes: string) => void;
    isReadonly: boolean;
};

export default function SubmissionNotesSection({ initialNotes, onNotesChange, isReadonly }: SubmissionNotesSectionProps) {
    const [notes, setNotes] = useState(initialNotes);

    useEffect(() => {
        setNotes(initialNotes);
    }, [initialNotes]);

    const handleBlur = () => {
        // Only notify parent if the notes have actually changed
        if (notes !== initialNotes) {
            onNotesChange(notes);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MessageSquareWarning />
                    Ghi chú / Vấn đề phát sinh
                </CardTitle>
                <CardDescription>
                    Báo cáo mọi sự cố hoặc sự kiện đáng chú ý trong ca của bạn tại đây.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Textarea
                    placeholder="Khách có phàn nàn gì không? Có bất cứ vấn đề gì muốn đề xuất thì cứ nói nhé! (Có thể bỏ trống)"
                    rows={5}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={handleBlur}
                    disabled={isReadonly}
                />
            </CardContent>
        </Card>
    );
}
