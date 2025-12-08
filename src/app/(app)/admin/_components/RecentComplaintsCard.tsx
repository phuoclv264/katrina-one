'use client';

import React from 'react';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { MessageSquareWarning } from 'lucide-react';
import type { WhistleblowingReport, ManagedUser } from '@/lib/types';
import { ListCard } from './ListCard';

type RecentComplaintsCardProps = {
  complaints: WhistleblowingReport[];
  allUsers: ManagedUser[];
};

export function RecentComplaintsCard({ complaints, allUsers }: RecentComplaintsCardProps) {
  const formatDate = (dateValue: string | Date | Timestamp | undefined | null) => {
    if (!dateValue) return 'Không rõ thời gian';
    try {
      if (dateValue instanceof Timestamp) {
        return format(dateValue.toDate(), 'dd/MM/yyyy HH:mm');
      }
      return format(new Date(dateValue as string), 'dd/MM/yyyy HH:mm');
    } catch (error) {
      return 'Thời gian không hợp lệ';
    }
  };

  return (
  <ListCard title="Tố cáo mới nhất" icon={<MessageSquareWarning className="status-error" />} link="/reports-feed" linkText="Xem tất cả Tố cáo">
      {complaints.length > 0 ? complaints.slice(0, 4).map(item => (
        <div key={item.id} className="text-sm p-3 rounded-md border bg-muted/50 space-y-1">
          <div>
            <p className="font-semibold">{item.title}</p>
            <p className="text-xs text-muted-foreground">
            {formatDate(item.createdAt)} - Bởi {allUsers.find(u => u.uid === item.reporterId)?.displayName || 'Không rõ'}
            </p>
          </div>
          <p className="text-muted-foreground truncate italic">"{item.content}"</p>
        </div>
      )) : <p className="text-sm text-muted-foreground text-center py-4">Không có tố cáo nào gần đây.</p>}
    </ListCard>
  );
}