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
  shortName: z.string().describe("A short, unique abbreviation for the item name."),
  category: z.string(),
  supplier: z.string(),
  unit: z.string(),
  orderUnit: z.string().describe("The unit used when ordering the item, e.g., 'thùng', 'hộp', 'kg'."),
  conversionRate: z.number().describe("How many 'unit' are in one 'orderUnit'. If units are the same, this is 1."),
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
3.  Only modify the fields ('name', 'shortName', 'category', 'supplier', 'unit', 'orderUnit', 'conversionRate', 'minStock', 'orderSuggestion', 'isImportant', 'requiresPhoto') as specified in the user's instruction. If the instruction does not mention a field, do not change it.
4.  Perform the instruction accurately. For example, if asked to "increase minStock by 2 for all toppings", find all items with 'category: "TOPPING"' and add 2 to their existing 'minStock'.
5.  To change a value for a specific *type* of item (e.g., "đổi nhà cung cấp của tất cả siro thành ABC"), you must identify all items that logically belong to that type by looking for the keyword in the 'category' or 'name' field (like 'SIRO', 'TRÁI CÂY', 'mứt') and apply the change *only* to those items.
6.  To change a value for a specific *supplier* (e.g., "đặt tất cả mặt hàng của nhà cung cấp A thành quan trọng"), you must find all items with the 'supplier' field matching 'A' and apply the change.
7.  When asked to generate a 'tên viết tắt' (shortName), your main goal is to create a **short, unique, and recognizable abbreviation** for each item name. You MUST follow these sub-rules VERY CAREFULLY:
    a. Create a meaningful abbreviation based on the full 'name', not just random letters. Examples: 
        - GOOD: 'Đào Ngâm Thái Lan Dedu' -> 'Đào ngâm TL'. 
        - GOOD: 'Sữa tươi thanh trùng không đường' -> 'Sữa TT không đường'.
        - BAD: 'Sữa tươi thanh trùng không đường' -> 'Sữa tươi' (too generic).
    b. **CRITICAL**: The generated 'shortName' MUST BE UNIQUE across the entire list. No two items can have the same 'shortName'. You must check your own output to ensure uniqueness before returning it. If two items have similar names (e.g., 'Trà sữa ô long nhài' and 'Trà sữa ô long cao sơn'), you MUST find a way to differentiate their shortNames (e.g., 'TS ô long nhài' vs 'TS ô long CS'). Your final output JSON must not have any duplicate 'shortName' values.
    c. **CRITICAL**: If the user's instruction provides a specific rule for generating the shortName (e.g., "Tạo tên viết tắt cho các món mứt, yêu cầu phải bắt đầu bằng chữ 'Mứt'"), you MUST STRICTLY ADHERE to that rule for the specified items. Identify the target items based on their 'name' or 'category', apply the prefix/rule, and then ensure the rest of the shortName is both recognizable and unique.
8.  If 'orderUnit' is not specified or is the same as 'unit', the 'conversionRate' MUST be 1. If 'orderUnit' is different (e.g., order by 'thùng', but unit is 'hộp'), 'conversionRate' must be a number greater than 1, representing how many 'unit' are in one 'orderUnit'.
9.  If the user instruction is a large block of text where each line represents an item, you must parse each line and update the corresponding item in the list. The format for each line will be: 'CATEGORY\\tNAME\\tSHORTNAME\\tSUPPLIER\\tUNIT\\tORDERUNIT\\tCONVERSIONRATE\\tMINSTOCK\\tORDERSUGGESTION\\tREQUIREPHOTO\\tISIMPORTANT'. You must find the item by NAME and update all its properties based on the provided line data.

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
