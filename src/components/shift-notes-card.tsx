
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

type ShiftNotesCardProps = {
  initialIssues: string;
  onSave: (newIssues: string) => void;
  disabled: boolean;
};

const ShiftNotesCard = ({ initialIssues, onSave, disabled }: ShiftNotesCardProps) => {
  const [issueInputValue, setIssueInputValue] = useState(initialIssues);

  // When the initialIssues prop changes (e.g., report reloaded from server),
  // update the local state.
  useEffect(() => {
    setIssueInputValue(initialIssues);
  }, [initialIssues]);

  const handleBlur = () => {
    // Only call the save function if the value has actually changed.
    if (issueInputValue !== initialIssues) {
      onSave(issueInputValue);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ghi chú ca</CardTitle>
        <CardDescription>Báo cáo mọi sự cố hoặc sự kiện đáng chú ý trong ca của bạn.</CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea
          placeholder="Khách có phàn nàn gì không?
          Có bất cứ vấn đề gì muốn đề xuất thì cứ nói nhé!"
          value={issueInputValue}
          onChange={(e) => setIssueInputValue(e.target.value)}
          onBlur={handleBlur}
          disabled={disabled}
        />
      </CardContent>
    </Card>
  );
};

// Memoize the component to prevent re-renders when the parent's state changes,
// as long as the props passed to this component remain the same.
export default React.memo(ShiftNotesCard);
