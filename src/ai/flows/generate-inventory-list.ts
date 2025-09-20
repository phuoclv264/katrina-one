

'use server';
/**
 * @fileOverview A flow for generating an inventory list from text or an image.
 *
 * - generateInventoryList - A function that handles the inventory list generation.
 * - GenerateInventoryListInput - The input type for the generateInventoryList function.
 * - GenerateInventoryListOutput - The return type for the generateInventoryList function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateInventoryListInputSchema = z.object({
    source: z.enum(['text', 'image']),
    inputText: z.string().optional().describe('A string containing a table of inventory items, likely pasted from a spreadsheet.'),
    imageDataUri: z.string().optional().describe("A photo of an inventory list, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
});
export type GenerateInventoryListInput = z.infer<typeof GenerateInventoryListInputSchema>;

const ParsedInventoryItemSchema = z.object({
    name: z.string().describe('The name of the inventory item.'),
    category: z.string().describe('The category or group of the item (e.g., "TRÁI CÂY", "TOPPING", "SIRO").'),
    supplier: z.string().describe('The name of the supplier for this item.'),
    unit: z.string().describe('The unit of measurement for the item (e.g., "kg", "box", "lon", "cây").'),
    orderUnit: z.string().optional().describe("The unit used for ordering, if different from the main unit. E.g., 'thùng', 'két'."),
    conversionRate: z.number().optional().describe("If orderUnit is provided, this is how many 'units' are in one 'orderUnit'. E.g., if unit is 'lon' and orderUnit is 'thùng' with 24 cans, this is 24."),
    minStock: z.number().describe('The minimum required stock level for this item.'),
    orderSuggestion: z.string().describe('The suggested quantity to order when stock is low (e.g., "5" or "5kg").'),
    isImportant: z.boolean().optional().describe('Whether this item requires a stock count to submit the report.'),
    requiresPhoto: z.boolean().optional().describe('Whether this item requires a photo as proof.'),
});

const GenerateInventoryListOutputSchema = z.object({
    items: z.array(ParsedInventoryItemSchema).describe('An array of parsed inventory items.'),
});
export type GenerateInventoryListOutput = z.infer<typeof GenerateInventoryListOutputSchema>;

export async function generateInventoryList(input: GenerateInventoryListInput): Promise<GenerateInventoryListOutput> {
    return generateInventoryListFlow(input);
}

const prompt = ai.definePrompt({
    name: 'generateInventoryListPrompt',
    input: { schema: GenerateInventoryListInputSchema },
    output: { schema: GenerateInventoryListOutputSchema },
    prompt: `You are an expert data entry assistant. Your task is to analyze the provided input (either text or an image) and extract a list of inventory items.

The input contains a list of products for a coffee shop. You must extract the following fields for each item:
- name: The name of the product.
- category: The group or type of the product. Infer this from the context if not explicitly stated. Examples: SIRO, TRÁI CÂY, TOPPING, CCDC.
- supplier: The name of the supplier for this item.
- unit: The unit of measurement (e.g., kg, gram, hộp, gói, lon, cây, etc.).
- orderUnit: The unit used for ordering. If not specified, it's the same as 'unit'. Look for text like "(12 hộp/thùng)" which implies 'thùng' is the orderUnit.
- conversionRate: How many 'unit' are in one 'orderUnit'. From "(12 hộp/thùng)", the conversionRate is 12. If not specified, it's 1.
- minStock: The minimum stock quantity required.
- orderSuggestion: The suggested quantity to order when stock is low.
- isImportant: A boolean. If the text indicates this is a critical or mandatory item to check, set this to true. Default to false.
- requiresPhoto: A boolean. If the text mentions needing a photo or visual proof, set this to true. Default to false.

The input text could be a table pasted from a spreadsheet, or it could be a multi-line string where each line represents an item, with fields separated by a hyphen '-'.

Analyze the following input and extract all items. Pay close attention to the columns, rows, or separators.
If the input is an image, use OCR to read the text from the image first.

Input:
{{#if inputText}}
\`\`\`
{{{inputText}}}
\`\`\`
{{/if}}
{{#if imageDataUri}}
{{media url=imageDataUri}}
{{/if}}

Return the data as a JSON object matching the prescribed output schema.
`,
});

const generateInventoryListFlow = ai.defineFlow(
    {
        name: 'generateInventoryListFlow',
        inputSchema: GenerateInventoryListInputSchema,
        outputSchema: GenerateInventoryListOutputSchema,
    },
    async (input) => {
        const { output } = await prompt(input);
        return output!;
    }
);
