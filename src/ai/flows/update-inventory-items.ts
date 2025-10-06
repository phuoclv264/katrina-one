'use server';
/**
 * @fileOverview A flow for updating a list of inventory items based on a user's natural language instruction.
 *
 * - updateInventoryItems - A function that handles the batch update process.
 * - UpdateInventoryItemsInput - The input type for the updateInventoryItems function.
 * - UpdateInventoryItemsOutput - The return type for the updateInventoryItems function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { UnitDefinition } from '@/lib/types';

const InventoryItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string().describe("A short, unique abbreviation for the item name."),
  category: z.string(),
  supplier: z.string(),
  baseUnit: z.string().describe("The base unit for stock tracking."),
  units: z.custom<UnitDefinition[]>().describe("An array of all possible units for this item, each with a name and conversion rate to the base unit."),
  minStock: z.number(),
  orderSuggestion: z.string(),
  isImportant: z.boolean().optional(),
  requiresPhoto: z.boolean().optional(),
  dataType: z.enum(['number', 'list']).optional(),
  listOptions: z.array(z.string()).optional(),
});

const UpdateInventoryItemsInputSchema = z.object({
  items: z.array(InventoryItemSchema).describe('The complete current list of inventory items.'),
  instruction: z.string().describe("The user's instruction on how to modify the items."),
});
export type UpdateInventoryItemsInput = z.infer<typeof UpdateInventoryItemsInputSchema>;

const UpdateInventoryItemsOutputSchema = z.object({
  items: z.array(InventoryItemSchema).describe('The list of inventory items after applying the required modifications.'),
});
export type UpdateInventoryItemsOutput = z.infer<typeof UpdateInventoryItemsOutputSchema>;


export async function updateInventoryItems(input: UpdateInventoryItemsInput): Promise<UpdateInventoryItemsOutput> {
    return updateInventoryItemsFlow(input);
}

const prompt = ai.definePrompt({
    name: 'updateInventoryItemsPrompt',
    input: { schema: UpdateInventoryItemsInputSchema },
    output: { schema: UpdateInventoryItemsOutputSchema },
    prompt: `You are an expert data management assistant for a restaurant's inventory system.
Your task is to modify a given JSON list of inventory items based on a specific instruction from the user.

IMPORTANT RULES:
1.  You MUST return the **entire list** of items. The number of items in the output array must be exactly the same as in the input array.
2.  You MUST preserve the original 'id' of every item. Do not change, add, or remove 'id' fields.
3.  Only modify the fields as specified in the user's instruction. If the instruction does not mention a field, do not change it.
4.  Perform the instruction accurately. For example, if asked to "increase minStock by 2 for all toppings", find all items with 'category: "TOPPING"' and add 2 to their existing 'minStock'.
5.  To change a value for a specific *type* of item (e.g., "đổi nhà cung cấp của tất cả siro thành ABC"), you must identify all items that logically belong to that type by looking for the keyword in the 'category' or 'name' field and apply the change *only* to those items.
6.  When asked to generate a 'tên viết tắt' (shortName), your main goal is to create a **short, unique, and recognizable abbreviation** for each item name. You MUST check your own output to ensure uniqueness before returning it.
7.  When asked to change units, you must update the 'baseUnit' and the 'units' array accordingly. For example, if asked "đổi đơn vị của sữa thành ml", you should set 'baseUnit: "ml"' and ensure the 'units' array has an entry for "ml" with a conversionRate of 1. If other units exist (like "hộp"), you must recalculate their conversion rates relative to the new base unit.

User's Instruction: "{{{instruction}}}"

Current list of items to modify:
{{{json items}}}

Now, apply the instruction to the list and return the complete, modified list of items as a JSON object matching the prescribed output schema. Ensure the number of items in your output is exactly the same as the input.
`,
});

const updateInventoryItemsFlow = ai.defineFlow(
    {
        name: 'updateInventoryItemsFlow',
        inputSchema: UpdateInventoryItemsInputSchema,
        outputSchema: UpdateInventoryItemsOutputSchema,
    },
    async (input) => {
        const { output } = await prompt(input);
        return output!;
    }
);
