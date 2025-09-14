
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
import type { InventoryStockRecord } from '@/lib/types';


const InventoryItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    unit: z.string(),
    supplier: z.string().describe('The supplier of the item.'),
    minStock: z.number().describe('The minimum required stock level for this item.'),
    orderSuggestion: z.string().describe('The suggested quantity to order when stock is low (e.g., "5" or "5kg").'),
    dataType: z.enum(['number', 'list']).describe('The type of stock data: either a numerical quantity or a text-based status from a list.'),
    currentStock: z.custom<InventoryStockRecord>().describe('An object containing the current stock level and photo proof if required.'),
});

const GenerateInventoryOrderSuggestionInputSchema = z.object({
  items: z.array(InventoryItemSchema),
});
export type GenerateInventoryOrderSuggestionInput = z.infer<typeof GenerateInventoryOrderSuggestionInputSchema>;


const OrderItemSchema = z.object({
    itemId: z.string().describe('The ID of the item to order.'),
    quantityToOrder: z.string().describe('The quantity and unit to order, e.g., "5kg" or "2 boxes".'),
});

const OrderBySupplierSchema = z.object({
    supplier: z.string().describe('The name of the supplier.'),
    itemsToOrder: z.array(OrderItemSchema).describe('A list of items to order from this specific supplier.'),
});

const GenerateInventoryOrderSuggestionOutputSchema = z.object({
  summary: z.string().describe('A brief summary of the order suggestion, e.g., "Cần đặt thêm 5 mặt hàng từ 3 nhà cung cấp."'),
  ordersBySupplier: z.array(OrderBySupplierSchema).describe('A list of orders, grouped by supplier.'),
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

An item needs to be reordered based on its 'dataType' and 'currentStock.stock' value.
- If 'dataType' is 'number', you MUST reorder it if 'currentStock.stock' is less than its 'minStock'.
- If 'dataType' is 'list', you must interpret the text description in 'currentStock.stock'. If the value is "hết" (out of stock) or "gần hết" (almost out of stock), you MUST REORDER the item. If the value is "còn đủ" (sufficient) or "dư xài" (surplus), DO NOT reorder it.
- If 'currentStock.stock' is a number and is greater than or equal to 'minStock', DO NOT reorder it.

For each item that needs reordering, you must use the 'orderSuggestion' field to determine the quantity to order. The 'orderSuggestion' provides the exact amount to order (e.g., if it says "5kg", you should order "5kg").

Your output must be a JSON object that includes:
1. A 'summary' (in Vietnamese) of how many items need to be ordered and from how many suppliers.
2. A list of 'ordersBySupplier', where each object in the list contains the 'supplier' name and an 'itemsToOrder' array. Each item in 'itemsToOrder' should have the 'itemId' and the 'quantityToOrder'.

Here is the list of inventory items:
{{#each items}}
- Item ID: {{{id}}}, Name: {{{name}}}, Supplier: {{{supplier}}}, Unit: {{{unit}}}, Minimum Stock: {{{minStock}}}, Data Type: {{{dataType}}}, Current Stock: {{{currentStock.stock}}}, Suggested Order Quantity: {{{orderSuggestion}}}
{{/each}}

Analyze this list and generate the order suggestion, ensuring items are grouped by their respective supplier.
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
