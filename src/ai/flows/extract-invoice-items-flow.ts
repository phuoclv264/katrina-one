
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
    totalAmount: z.number().describe("The final line item total price ('thành tiền'). This is the most important value to check for discounts. Parse this number with the same rules as unitPrice."),
    lineItemDiscount: z.number().describe("The calculated discount for this specific line item. You MUST calculate this as `(quantity * unitPrice) - totalAmount`. If the result is negative, this value MUST be 0. If no discount is found, this value MUST be 0."),
    matchedItemId: z.string().nullable().describe("The ID of the inventory item that this invoice item most closely matches. Null if no confident match is found."),
    status: z.enum(['matched', 'unmatched']).describe("The status of the match. 'matched' if a confident match was found, 'unmatched' otherwise."),
});

const InvoiceResultSchema = z.object({
  invoiceTitle: z.string().describe("A descriptive title for this invoice group, like 'Hóa đơn 1'. This is crucial for grouping."),
  imageIds: z.array(z.string()).describe("An array of IDs of all images that belong to this single invoice."),
  items: z.array(ExtractedItemSchema).describe("An array of all items extracted from this single invoice group."),
  totalDiscount: z.number().describe("The total discount for this invoice group. You MUST calculate this by SUMMING UP all `lineItemDiscount` values from every item in this invoice. Do not look for a separate total discount field on the invoice."),
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
  prompt: `You are an expert OCR and document analysis AI specialized in restaurant invoices. Your primary goal is ACCURACY.

Your task is to analyze the provided array of images and a list of available inventory items.
You MUST process the data with the following strict rules:

1.  **Identify and Validate Images (CRITICAL):**
    *   Carefully analyze EACH image.
    *   An image is considered "valid" ONLY if it is clearly a part of an invoice AND its text is sharp and readable.
    *   Any image that is NOT a recognizable invoice (e.g., photos of goods, random pictures) or is too blurry, dark, or unreadable MUST be **COMPLETELY IGNORED**. Do not attempt to guess data from these images. They should not appear in any 'results' group.

2.  **Group Valid Invoice Images:**
    *   After identifying all "valid" images, group them by the physical invoice they belong to.
    *   If multiple valid images are just different parts of the same long invoice, you MUST group them into a single invoice group.
    *   Use textual similarity, invoice structure (store name, date, total amount) to confirm duplicates. Each unique invoice = one group with all related image IDs.

3.  **Extract Invoice Line Items:**
    *   For each invoice group, carefully locate the columns for **item name**, **quantity**, **unit price**, and **total amount (thành tiền)**.
    *   Always select the column that contains the *full descriptive item name*, not the numeric/short code. Example: "CF001 Cà phê Sữa Đá" → extract \`"Cà phê Sữa Đá"\`.
    *   For each line item, extract:
        *   \`itemName\` (text as shown on invoice, descriptive name only)
        *   \`quantity\` (integer/decimal)
        *   \`unitPrice\` (per-unit price, parsed correctly)
        *   \`totalAmount\` (the final line total price, 'thành tiền', parsed correctly)

4.  **Calculate Discounts (CRITICAL):**
    *   **Per Item:** For each extracted line item, you MUST calculate the \`lineItemDiscount\` using the formula: \`(quantity * unitPrice) - totalAmount\`. If this value is less than or equal to zero, the \`lineItemDiscount\` MUST be 0.
    *   **Total for Invoice:** For each invoice group, you MUST calculate the \`totalDiscount\` by SUMMING UP the \`lineItemDiscount\` of EVERY item within that group. **Do not** look for a separate total discount field on the invoice itself. Your final \`totalDiscount\` is the sum of discounts from each line item.

5.  **Match Items with Inventory:**
    *   Use fuzzy and semantic matching (e.g., "Cafe Robusta" ≈ "Cà phê Robusta").
    *   If a confident match is found → return \`matchedItemId\` and \`status = 'matched'\`.
    *   If not confident → return \`matchedItemId = null\` and \`status = 'unmatched'\`.

6.  **Final Output Format:**
    *   \`isInvoiceFound\`: set to \`true\` if at least one valid, readable invoice was detected and processed, \`false\` otherwise.
    *   \`results\`: one object per unique invoice group. This array must be empty if no valid invoices were found.
        *   \`invoiceTitle\`: unique name like "Hóa đơn 1", "Hóa đơn 2"...
        *   \`imageIds\`: IDs of all valid images in that group.
        *   \`items\`: extracted items with ALL fields, including the calculated \`lineItemDiscount\`.
        *   \`totalDiscount\`: The total summed discount for this invoice group, calculated as described in step 4.

**Input Provided:**
- Images (some may be valid invoices, some not, some duplicates)
    {{#each images}}
    Image ID: {{{this.id}}}
    {{media url=this.uri}}
    {{/each}}
- List of inventory items for matching
    \`\`\`json
    {{{json inventoryItems}}}
    \`\`\`

**Your Output:**
- A clean JSON object strictly following the provided schema.
- Ignore invalid or unreadable images completely.
- Group valid duplicate invoices properly.
- Ensure all calculations are performed as instructed.
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
