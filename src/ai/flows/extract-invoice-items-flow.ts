'use server';
/**
 * @fileOverview An AI flow to extract structured item data from one or more invoice images.
 * It groups similar invoice images to avoid duplicate processing.
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
  invoiceTitle: z.string().describe("A descriptive title for this invoice group, like 'Hóa đơn 1'. This is crucial for grouping."),
  imageIds: z.array(z.string()).describe("An array of IDs of all images that belong to this single invoice."),
  items: z.array(ExtractedItemSchema).describe("An array of all items extracted from this single invoice group."),
});

const ExtractInvoiceItemsInputSchema = z.object({
  images: z.array(z.object({
    id: z.string(),
    uri: z.string().describe("An image provided as a data URI. It must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
  })).describe("An array of image objects, each with a unique ID and a data URI."),
  inventoryItems: z.custom<InventoryItem[]>().describe("An array of all available inventory items to match against."),
});
export type ExtractInvoiceItemsInput = z.infer<typeof ExtractInvoiceItemsInputSchema>;

const ExtractInvoiceItemsOutputSchema = z.object({
    isInvoiceFound: z.boolean().describe("Whether at least one valid invoice was found in the provided images."),
    results: z.array(InvoiceResultSchema).describe("An array where each element represents a unique invoice found in the images. This should be empty if no invoices are found."),
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
Your task is to analyze the provided array of images and a list of available inventory items. You must perform the following steps with extreme precision:

1.  **Group Identical Invoices:** Look through all provided images. It is VERY IMPORTANT to identify all images that belong to the *same* physical invoice (e.g., multiple photos of the same long receipt). Group the IDs of these identical images together. Each unique invoice should form one group. Ignore any images that are not invoices (e.g., photos of goods).

2.  **Process Each Invoice Group:** For each group of invoice images you identify, you must process it as a *single* entity. Create one result object for each unique invoice.

3.  **Extract and Match from Group:** For each invoice group, perform the following:
    a.  **Extract Data:** Read all images within the group to gather all line items. For each line item, extract the **Item Name**, **Quantity**, and **Unit Price** with perfect accuracy. It is CRITICAL that you parse numbers correctly, ignoring thousand separators (like '.' or ',') and correctly identifying the decimal separator. For example: '100.000,00' and '100,000.00' must both be interpreted as the number 100000. A value of '100.000' should be interpreted as 100000.
    b.  **Match with Inventory:** For each item you extract, compare its name against the provided list of inventory items. Use fuzzy matching and semantic understanding (e.g., "Cafe Robusta" matches "Cà phê Robusta"). If you find a confident match, set \`matchedItemId\` to the inventory item's \`id\` and \`status\` to \`'matched'\`. Otherwise, set \`matchedItemId\` to \`null\` and \`status\` to \`'unmatched'\`.

4.  **Format the Final Output:**
    a. Create one result object for each unique invoice group.
    b. Assign a unique title to each, like "Hóa đơn 1", "Hóa đơn 2", etc.
    c. Populate the \`imageIds\` array with ALL the original IDs of the images belonging to that group. This is CRITICAL.
    d. Populate the \`items\` array with all the items you extracted and matched from that specific invoice group.
    e. If no valid invoices are found in any of the images, set \`isInvoiceFound\` to \`false\` and return an empty \`results\` array. Otherwise, set \`isInvoiceFound\` to \`true\`.

**Input Data:**

*   **Images (some of these could be for the same invoice):**
    {{#each images}}
    Image ID: {{{this.id}}}
    {{media url=this.uri}}
    {{/each}}

*   **Available Inventory Items (for matching):**
    \`\`\`json
    {{{json inventoryItems}}}
    \`\`\`

Return a clean JSON object matching the prescribed output schema.
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
         if (error.message && (error.message.includes('503 Service Unavailable') || error.message.includes('429 Too Many Requests'))) {
            console.warn('AI model is overloaded or rate-limited. Retrying in 2 seconds...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            const { output } = await prompt(input);
            return output!;
        }
        throw error;
    }
  }
);
