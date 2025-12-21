'use client';
import { useParams } from 'next/navigation';
import ChecklistView from './_components/checklist-view';

export default function ChecklistPageComponent() {
  const params = useParams();
  const shiftKey = params.shift as string;

  return <ChecklistView shiftKey={shiftKey} isStandalone={true} />;
}