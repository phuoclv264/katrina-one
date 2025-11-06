'use client';

import React from 'react';
import { format } from 'date-fns';
import { MessageSquareWarning } from 'lucide-react';
import type { WhistleblowingReport, ManagedUser } from '@/lib/types';
import { ListCard } from './ListCard';

type RecentComplaintsCardProps = {
  complaints: WhistleblowingReport[];
  allUsers: ManagedUser[];
};

export function RecentComplaintsCard({ complaints, allUsers }: RecentComplaintsCardProps) {
  return (
    <ListCard title="Tố cáo mới nhất" icon={<MessageSquareWarning className="text-red-500" />} link="/reports-feed" linkText="Xem tất cả Tố cáo">
      {complaints.length > 0 ? complaints.slice(0, 4).map(item => (
        <div key={item.id} className="text-sm p-2 rounded-md border bg-muted/50">
          <p className="font-semibold">{item.title}</p>
          <p className="text-muted-foreground">
            {format(new Date(item.createdAt as string), 'dd/MM/yyyy HH:mm')} - Bởi {allUsers.find(u => u.uid === item.reporterId)?.displayName || 'Không rõ'}
          </p>
        </div>
      )) : <p className="text-sm text-muted-foreground text-center py-4">Không có tố cáo nào gần đây.</p>}
    </ListCard>
  );
}