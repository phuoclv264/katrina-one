'use server';
/**
 * @fileOverview An AI flow to extract structured item data from one or more invoice images.
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

const InvoiceResultSchema = z.object({
  invoiceTitle: z.string().describe("A descriptive title for this invoice, like 'Hóa đơn 1'. This is crucial for grouping."),
  items: z.array(ExtractedItemSchema).describe("An array of items extracted from this specific invoice."),
});

const ExtractInvoiceItemsInputSchema = z.object({
  imageUris: z.array(z.string()).describe("An array of images provided as data URIs. At least one of these should be an invoice. Each must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
  inventoryItems: z.custom<InventoryItem[]>().describe("An array of all available inventory items to match against."),
});
export type ExtractInvoiceItemsInput = z.infer<typeof ExtractInvoiceItemsInputSchema>;

const ExtractInvoiceItemsOutputSchema = z.object({
    isInvoiceFound: z.boolean().describe("Whether at least one valid invoice was found in the provided images."),
    results: z.array(InvoiceResultSchema).describe("An array where each element represents an invoice found in the images. Each element contains the items extracted from that single invoice. This should be empty if no invoices are found."),
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
Your task is to analyze the provided array of images and a list of available inventory items. You must perform the following steps:

1.  **Identify All Invoices:** Look through all the provided images. Identify EVERY image that is a valid purchase invoice. Other images might be photos of the goods, which you should ignore for data extraction. If no image appears to be a valid invoice, set \`isInvoiceFound\` to \`false\` and return an empty \`results\` array.

2.  **Process Each Invoice Separately:** For each invoice image you identify, you must process it as a separate entity. You will create one result object for each invoice.

3.  **Extract and Match:** For each identified invoice, perform the following:
    a.  **Extract Data:** Read the invoice and identify all line items. For each line item, extract the **Item Name**, **Quantity**, and **Unit Price** with perfect accuracy. It is CRITICAL that you parse numbers correctly, ignoring thousand separators (like '.' or ',') and correctly identifying the decimal separator. For example: '100.000,00' and '100,000.00' must both be interpreted as the number 100000. A value of '100.000' should be interpreted as 100000.
    b.  **Match with Inventory:** For each item you extract, compare its name against the provided list of inventory items. Use fuzzy matching and semantic understanding (e.g., "Cafe Robusta" matches "Cà phê Robusta"). If you find a confident match, set \`matchedItemId\` to the inventory item's \`id\` and \`status\` to \`'matched'\`. Otherwise, set \`matchedItemId\` to \`null\` and \`status\` to \`'unmatched'\`.

4.  **Group and Title Results:**
    a. Create an object for each processed invoice.
    b. Assign a unique title to each, like "Hóa đơn 1", "Hóa đơn 2", etc.
    c. Populate the \`items\` array within this object with all the items you extracted and matched from that specific invoice.

**Input Data:**

*   **Images (one or more of these could be invoices):**
    {{#each imageUris}}
    {{media url=this}}
    {{/each}}

*   **Available Inventory Items (for matching):**
    \`\`\`json
    {{{json inventoryItems}}}
    \`\`\`

If at least one valid invoice is found, set \`isInvoiceFound\` to \`true\`. Return a clean JSON object where the \`results\` field is an array of these grouped invoice objects.
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
