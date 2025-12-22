'use client';
import ChecklistView from './_components/checklist-view';

export default function ChecklistPageComponent({ shift }: { shift: string }) {
  return <ChecklistView shiftKey={shift} isStandalone={true} />;
}