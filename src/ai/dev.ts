
import { config } from 'dotenv';
config();

import '@/ai/flows/generate-starting-task-lists.ts';
import '@/ai/flows/generate-inventory-list.ts';
import '@/ai/flows/generate-server-tasks.ts';
import '@/ai hikes/flows/generate-bartender-tasks.ts';
import '@/ai/flows/generate-comprehensive-tasks.ts';
import '@/ai/flows/sort-tasks.ts';
import '@/ai/flows/update-inventory-items.ts';
import '@/ai/flows/generate-daily-summary.ts';
import '@/ai/flows/extract-revenue-flow.ts';
import '@/ai/flows/extract-invoice-items-flow.ts';
