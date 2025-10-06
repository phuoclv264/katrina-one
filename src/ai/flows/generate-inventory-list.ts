

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
import type { UnitDefinition } from '@/lib/types';

const GenerateInventoryListInputSchema = z.object({
    source: z.enum(['text', 'image']),
    inputText: z.string().optional().describe('A string containing a table of inventory items, likely pasted from a spreadsheet.'),
    imageDataUri: z.string().optional().describe("A photo of an inventory list, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
});
export type GenerateInventoryListInput = z.infer<typeof GenerateInventoryListInputSchema>;

const ParsedInventoryItemSchema = z.object({
    name: z.string().describe('The name of the inventory item.'),
    shortName: z.string().optional().describe("A short, unique abbreviation for the item name. If not provided, generate a reasonable one."),
    category: z.string().describe('The category or group of the item (e.g., "TRÁI CÂY", "TOPPING", "SIRO").'),
    supplier: z.string().describe('The name of the supplier for this item.'),
    baseUnit: z.string().describe("The base unit for stock tracking (e.g., 'kg', 'hộp'). This is the smallest unit of measurement."),
    units: z.custom<UnitDefinition[]>().describe("An array of all possible units for this item. MUST include the baseUnit with `isBaseUnit: true` and `conversionRate: 1`. Other units must have their conversion rate to the base unit."),
    minStock: z.number().describe('The minimum required stock level for this item, measured in the `baseUnit`.'),
    orderSuggestion: z.string().describe('The suggested quantity to order when stock is low (e.g., "5" or "5kg").'),
    isImportant: z.boolean().optional().describe('Whether this item requires a stock count to submit the report.'),
    requiresPhoto: z.boolean().optional().describe('Whether this item requires a photo as proof.'),
    dataType: z.enum(['number', 'list']).optional().describe("The data type for stock checking. 'number' for quantity input, 'list' for selecting a status."),
    listOptions: z.array(z.string()).optional().describe("If dataType is 'list', this is an array of possible statuses, e.g., ['hết', 'còn đủ', 'dư xài']."),
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
    prompt: `You are an expert data entry assistant. Your task is to analyze the provided input (either text or an image) and extract a list of inventory items with a flexible unit system.

The input could be a multi-line string where each line represents an item with fields separated by hyphens, OR it could be a table pasted from a spreadsheet, where columns are separated by '|'.

The table format has the following columns:
Nhóm | Tên mặt hàng | Tên viết tắt | Nhà cung cấp | ĐV Cơ sở | Tồn tối thiểu | Gợi ý đặt hàng

You must extract the following fields for each item:
- name: The full name of the product. From 'Tên mặt hàng'.
- shortName: A short, unique abbreviation. From 'Tên viết tắt'. If not explicitly provided, create a meaningful one.
- category: The group or type of the product. From 'Nhóm'. Infer this from the context if not explicitly stated.
- supplier: The name of the supplier for this item. From 'Nhà cung cấp'.
- baseUnit: CRITICAL. The base unit from 'ĐV Cơ sở'. Determine the smallest, most logical unit for tracking stock (e.g., 'hộp', 'kg', 'ml', 'gram').
- units: CRITICAL. This MUST be an array of unit definitions.
    - It MUST contain at least one entry for the \`baseUnit\`, with \`isBaseUnit: true\` and \`conversionRate: 1\`.
    - If other units are mentioned (e.g., 'thùng' which contains 12 'hộp'), you MUST create another entry for it. Example: \`{ name: 'thùng', isBaseUnit: false, conversionRate: 12 }\`. This means 1 thùng = 12 baseUnits (hộp).
    - If no other units are mentioned, the 'units' array will contain only the base unit definition.
- minStock: The minimum stock quantity, measured in the \`baseUnit\`. From 'Tồn tối thiểu'.
- orderSuggestion: The suggested quantity to order when stock is low. From 'Gợi ý đặt hàng'.
- isImportant: Boolean. If text indicates it's critical, set to true. Default to false if not provided.
- requiresPhoto: Boolean. If text mentions a photo, set to true. Default to false if not provided.
- dataType: 'number' or 'list'. Default to 'number'.
- listOptions: If dataType is 'list', provide a default array: ['hết', 'gần hết', 'còn đủ', 'dư xài'].

If a field is not present in the input text, you MUST default it to a sensible value (e.g., empty string for text fields, 0 for numbers, false for booleans).

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
