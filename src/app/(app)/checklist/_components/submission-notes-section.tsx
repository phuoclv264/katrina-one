
'use client';
import { useState, useEffect, forwardRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquareWarning } from 'lucide-react';
import { cn } from '@/lib/utils';

type SubmissionNotesSectionProps = {
    initialNotes: string;
    onNotesChange: (notes: string) => void;
    isReadonly: boolean;
    isHighlighted?: boolean;
};

const SubmissionNotesSection = forwardRef<HTMLDivElement, SubmissionNotesSectionProps>(
    ({ initialNotes, onNotesChange, isReadonly, isHighlighted }, ref) => {
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

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onNotesChange(e.target.value);
        setNotes(e.target.value);
    }

    return (
        <Card 
            ref={ref} 
            className={cn('transition-all duration-300', isHighlighted && 'ring-2 ring-destructive shadow-lg shadow-destructive/20')}
        >
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
                    onChange={handleChange}
                    onBlur={handleBlur}
                    disabled={isReadonly}
                    className={cn(isHighlighted && 'bg-destructive/5')}
                />
            </CardContent>
        </Card>
    );
});

SubmissionNotesSection.displayName = 'SubmissionNotesSection';

export default SubmissionNotesSection;
