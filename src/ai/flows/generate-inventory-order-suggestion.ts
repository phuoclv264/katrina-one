
'use server';

/**
 * @fileOverview A flow for generating inventory order suggestions.
 *
 * - generateInventoryOrderSuggestion - Analyzes current stock and suggests orders.
 * - GenerateInventoryOrderSuggestionInput - The input type for the flow.
 * - GenerateInventoryOrderSuggestionOutput - The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const InventoryItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    unit: z.string(),
    minStock: z.number().describe('The minimum required stock level for this item.'),
    orderSuggestion: z.string().describe('The suggested quantity to order when stock is low (e.g., "5" or "5kg").'),
    currentStock: z.union([z.number(), z.string()]).describe('The current actual stock level entered by the employee. Can be a number or a text description like "còn ít", "sắp hết".'),
});

const GenerateInventoryOrderSuggestionInputSchema = z.object({
  items: z.array(InventoryItemSchema),
});
export type GenerateInventoryOrderSuggestionInput = z.infer<typeof GenerateInventoryOrderSuggestionInputSchema>;


const OrderItemSchema = z.object({
    itemId: z.string().describe('The ID of the item to order.'),
    quantityToOrder: z.string().describe('The quantity and unit to order, e.g., "5kg" or "2 boxes".'),
});

const GenerateInventoryOrderSuggestionOutputSchema = z.object({
  summary: z.string().describe('A brief summary of the order suggestion, e.g., "Cần đặt thêm 5 mặt hàng."'),
  itemsToOrder: z.array(OrderItemSchema).describe('A list of items that need to be re-ordered.'),
});
export type InventoryOrderSuggestion = z.infer<typeof GenerateInventoryOrderSuggestionOutputSchema>;


export async function generateInventoryOrderSuggestion(input: GenerateInventoryOrderSuggestionInput): Promise<InventoryOrderSuggestion> {
  return generateInventoryOrderSuggestionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateInventoryOrderSuggestionPrompt',
  input: { schema: GenerateInventoryOrderSuggestionInputSchema },
  output: { schema: GenerateInventoryOrderSuggestionOutputSchema },
  prompt: `You are an expert inventory management assistant for a coffee and tea shop.
Your task is to analyze the provided list of inventory items and determine which items need to be reordered.

An item needs to be reordered based on its 'currentStock'.
- If 'currentStock' is a number, you MUST reorder it if 'currentStock' is less than its 'minStock'.
- If 'currentStock' is a text description (e.g., "còn ít", "sắp hết", "gần hết"), you must interpret this as a low stock level and REORDER the item.
- If the 'currentStock' is a number and is greater than or equal to 'minStock', DO NOT reorder it.

For each item that needs reordering, you must use the 'orderSuggestion' field to determine the quantity to order. The 'orderSuggestion' provides the exact amount to order (e.g., if it says "5kg", you should order "5kg").

Your output must be a JSON object that includes:
1. A 'summary' (in Vietnamese) of how many items need to be ordered. If no items are needed, state that.
2. A list of 'itemsToOrder', containing the 'itemId' and the 'quantityToOrder' for each item that needs restocking.

Here is the list of inventory items:
{{#each items}}
- Item ID: {{{id}}}, Name: {{{name}}}, Unit: {{{unit}}}, Minimum Stock: {{{minStock}}}, Current Stock: {{{currentStock}}}, Suggested Order Quantity: {{{orderSuggestion}}}
{{/each}}

Analyze this list and generate the order suggestion.
`,
});

const generateInventoryOrderSuggestionFlow = ai.defineFlow(
  {
    name: 'generateInventoryOrderSuggestionFlow',
    inputSchema: GenerateInventoryOrderSuggestionInputSchema,
    outputSchema: GenerateInventoryOrderSuggestionOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
