
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

const InventoryItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  supplier: z.string(),
  unit: z.string(),
  minStock: z.number(),
  orderSuggestion: z.string(),
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
1.  You MUST return the **entire list** of items, including the ones that were not changed.
2.  You MUST NOT add or remove any items from the list. The number of items in the output array must be exactly the same as in the input array.
3.  You MUST preserve the original 'id' of every item. Do not change, add, or remove 'id' fields.
4.  Only modify the fields ('name', 'supplier', 'unit', 'minStock', 'orderSuggestion') as specified in the user's instruction. If the instruction does not mention a field, do not change it.
5.  Perform the instruction accurately. For example, if asked to "increase minStock by 2 for all toppings", find all items with "TOPPING" in their name and add 2 to their existing 'minStock'.
6.  To change a value for a specific *type* of item (e.g., "đổi nhà cung cấp của tất cả siro thành ABC"), you must identify all items that logically belong to that type by looking for keywords in the 'name' field (like 'SIRO', 'TRÁI CÂY', etc.) and apply the change *only* to those items.

User's Instruction: "{{{instruction}}}"

Current list of items to modify:
{{{json items}}}

Now, apply the instruction to the list and return the complete, modified list of items as a JSON object matching the prescribed output schema.
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
