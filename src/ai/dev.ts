
import { config } from 'dotenv';
config();

import '@/ai/flows/generate-starting-task-lists.ts';
import '@/ai/flows/generate-inventory-order-suggestion.ts';
import '@/ai/flows/generate-inventory-list.ts';
import '@/ai/flows/generate-server-tasks.ts';
import '@/ai/flows/generate-bartender-tasks.ts';
import '@/ai...