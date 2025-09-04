
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
    name: z.string().describe('The full name of the inventory item.'),
    unit: z.string().describe('The unit of measurement for the item (e.g., "kg", "box", "lon", "cây").'),
    minStock: z.number().describe('The minimum required stock level for this item.'),
    orderSuggestion: z.string().describe('The suggested quantity to order when stock is low (e.g., "5" or "5kg").'),
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
- name: The full name of the product.
- unit: The unit of measurement (e.g., kg, gram, hộp, gói, lon, cây, etc.).
- minStock: The minimum stock quantity required.
- orderSuggestion: The suggested quantity to order when stock is low.

Analyze the following input and extract all items. Pay close attention to the columns and rows.
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
