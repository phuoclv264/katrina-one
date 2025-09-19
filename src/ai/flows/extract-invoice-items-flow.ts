'use server';
/**
 * @fileOverview An AI flow to extract structured item data from an invoice image.
 *
 * - extractInvoiceItems - A function that handles the invoice item extraction process.
 * - ExtractInvoiceItemsInput - The input type for the extractInvoiceItems function.
 * - ExtractInvoiceItemsOutput - The return type for the extractInvoiceItemsOutput function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { InventoryItem } from '@/lib/types';

const ExtractedItemSchema = z.object({
    itemName: z.string().describe("The exact name of the item as it appears on the invoice."),
    quantity: z.number().describe("The quantity of the item."),
    unitPrice: z.number().describe("The price for a single unit of the item. It is CRITICAL that you parse numbers correctly, ignoring thousand separators (like '.' or ',') and correctly identifying the decimal separator. For example: '100.000,00' and '100,000.00' must both be interpreted as the number 100000. A value of '100.000' should be interpreted as 100000."),
    matchedItemId: z.string().nullable().describe("The ID of the inventory item that this invoice item most closely matches. Null if no confident match is found."),
    status: z.enum(['matched', 'unmatched']).describe("The status of the match. 'matched' if a confident match was found, 'unmatched' otherwise."),
});

const ExtractInvoiceItemsInputSchema = z.object({
  imageDataUri: z.string().describe("A photo of the invoice, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
  inventoryItems: z.custom<InventoryItem[]>().describe("An array of all available inventory items to match against."),
});
export type ExtractInvoiceItemsInput = z.infer<typeof ExtractInvoiceItemsInputSchema>;

const ExtractInvoiceItemsOutputSchema = z.object({
    items: z.array(ExtractedItemSchema).describe("An array of items extracted from the invoice."),
});
export type ExtractInvoiceItemsOutput = z.infer<typeof ExtractInvoiceItemsOutputSchema>;

export async function extractInvoiceItems(input: ExtractInvoiceItemsInput): Promise<ExtractInvoiceItemsOutput> {
  return extractInvoiceItemsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractInvoiceItemsPrompt',
  input: { schema: ExtractInvoiceItemsInputSchema },
  output: { schema: ExtractInvoiceItemsOutputSchema },
  prompt: `You are an expert OCR and data matching specialist for a restaurant's inventory system.
Your task is to analyze the provided image of an invoice and a list of available inventory items. You must perform the following steps:

1.  **Extract Invoice Data:** Read the invoice image and identify all line items. For each line item, extract the following information with perfect accuracy:
    *   **Item Name:** The full name of the product as written on the invoice.
    *   **Quantity:** The number of units purchased.
    *   **Unit Price:** The price per single unit. Do not extract the total price for the line. It is CRITICAL that you parse numbers correctly, ignoring thousand separators (like '.' or ',') and correctly identifying the decimal separator. For example: '100.000,00' and '100,000.00' must both be interpreted as the number 100000. A value of '100.000' should be interpreted as 100000.

2.  **Match with Inventory:** For each item you extract from the invoice, you must compare its name against the provided list of inventory items.
    *   Use fuzzy matching and semantic understanding to find the best possible match. For example, "Cafe Robusta" on the invoice should match "Cà phê Robusta" in the inventory. "Hạt dưa loại 1" should match "Hạt dưa".
    *   If you find a confident match, set \`matchedItemId\` to the \`id\` of the corresponding item from the inventory list and set \`status\` to \`'matched'\`.
    *   If you cannot find a reasonably confident match, set \`matchedItemId\` to \`null\` and set \`status\` to \`'unmatched'\`.

**Input Data:**

*   **Invoice Image:**
    {{media url=imageDataUri}}

*   **Available Inventory Items (for matching):**
    \`\`\`json
    {{{json inventoryItems}}}
    \`\`\`

Return a clean JSON object containing an array of all items found on the invoice, with their extracted data and matching status.
`,
});

const extractInvoiceItemsFlow = ai.defineFlow(
  {
    name: 'extractInvoiceItemsFlow',
    inputSchema: ExtractInvoiceItemsInputSchema,
    outputSchema: ExtractInvoiceItemsOutputSchema,
  },
  async (input) => {
    try {
        const { output } = await prompt(input);
        return output!;
    } catch (error: any) {
         if (error.message && error.message.includes('503 Service Unavailable')) {
            console.warn('AI model is overloaded. Retrying in 2 seconds...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            const { output } = await prompt(input);
            return output!;
        }
        throw error;
    }
  }
);
