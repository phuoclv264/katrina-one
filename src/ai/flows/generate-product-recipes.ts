
'use server';
/**
 * @fileOverview An AI flow to parse product recipes from text or an image and link them to inventory items.
 *
 * - generateProductRecipes - A function that handles the recipe parsing and linking.
 * - ParsedProduct - The structure of a single parsed product.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { InventoryItem } from '@/lib/types';

// Define Zod schema for a single ingredient
const ProductIngredientSchema = z.object({
  inventoryItemId: z.string().nullable().describe("The ID of the matched inventory item. Null if no match is found."),
  name: z.string().describe("The original name of the ingredient as it appeared in the source text."),
  quantity: z.number().describe("The numeric quantity of the ingredient."),
  unit: z.string().describe("The unit of measurement for the quantity (e.g., 'ml', 'g', 'viên')."),
  isMatched: z.boolean().describe("True if a confident match was found in the inventory, otherwise false."),
});

// Define Zod schema for a single product (recipe)
const ParsedProductSchema = z.object({
  name: z.string().describe("The full name of the product, e.g., 'ESPRESSO (CÀ PHÊ ĐEN PHA MÁY)'."),
  category: z.string().describe("The category of the product, e.g., 'ESPRESSO', 'TRÀ SỮA'."),
  ingredients: z.array(ProductIngredientSchema).describe("An array of all ingredients for this product."),
  note: z.string().optional().describe("Any preparation notes or instructions associated with the product."),
});
export type ParsedProduct = z.infer<typeof ParsedProductSchema>;


// Define Zod schema for the AI flow's input
const GenerateProductRecipesInputSchema = z.object({
  inputText: z.string().optional().describe("A string containing the list of recipes, likely pasted from a document."),
  imageDataUri: z.string().optional().describe("An image of the recipe list, as a data URI."),
  inventoryItems: z.custom<InventoryItem[]>().describe("The complete list of current inventory items to match against."),
});
export type GenerateProductRecipesInput = z.infer<typeof GenerateProductRecipesInputSchema>;


// Define Zod schema for the AI flow's output
const GenerateProductRecipesOutputSchema = z.object({
  products: z.array(ParsedProductSchema).describe("An array of all parsed products."),
});
export type GenerateProductRecipesOutput = z.infer<typeof GenerateProductRecipesOutputSchema>;

// Exported function to be called from the UI
export async function generateProductRecipes(input: GenerateProductRecipesInput): Promise<GenerateProductRecipesOutput> {
  return generateProductRecipesFlow(input);
}


const prompt = ai.definePrompt({
  name: 'generateProductRecipesPrompt',
  input: { schema: GenerateProductRecipesInputSchema },
  output: { schema: GenerateProductRecipesOutputSchema },
  prompt: `You are an expert at parsing structured data from unstructured text, specifically for coffee shop recipes.
Your task is to analyze the provided text or image, which contains a list of drink recipes, and convert it into a structured JSON format.

You will be given a list of available inventory items to match against the ingredients in the recipes.

**CRITICAL INSTRUCTIONS:**

1.  **Identify Products:** Each product starts with a number and a name in all caps, e.g., "1. ESPRESSO (CÀ PHÊ ĐEN PHA MÁY)".
2.  **Extract Product Details:** For each product, you MUST extract:
    *   \`name\`: The full name of the product.
    *   \`category\`: Infer the category from the product name or surrounding context (e.g., 'ESPRESSO', 'CÀ PHÊ TRUYỀN THỐNG', 'TRÀ TRÁI CÂY', 'TRÀ SỮA').
    *   \`note\`: Any text in parentheses \`()\` that contains instructions or "Décor" notes should be extracted as the \`note\`.
    *   \`ingredients\`: A list of all ingredients.
3.  **Parse Ingredients:** For each ingredient line (starting with '-'):
    *   Extract the \`name\`, \`quantity\` (number), and \`unit\` (e.g., 'ml', 'g', 'rúp đơn').
    *   The \`name\` is the original text of the ingredient, e.g., "Coffee hạt V1 Vincent".
4.  **Match Ingredients to Inventory (VERY IMPORTANT):**
    *   For each parsed ingredient, you MUST search through the provided \`inventoryItems\` list.
    *   Use fuzzy and semantic matching to find the BEST possible match. For example, "Coffee hạt V1 Vincent" should match an inventory item named "Cà phê Robusta". "Sữa đặc NSPN" should match "Sữa đặc".
    *   **If a confident match is found:**
        *   Set \`isMatched\` to \`true\`.
        *   Set \`inventoryItemId\` to the \`id\` of the matched item from the \`inventoryItems\` list.
    *   **If no confident match is found:**
        *   Set \`isMatched\` to \`false\`.
        *   Set \`inventoryItemId\` to \`null\`.

**Input Data:**

**Available Inventory Items:**
\`\`\`json
{{{json inventoryItems}}}
\`\`\`

**Recipe List (from text or image):**
{{#if inputText}}
---
{{{inputText}}}
---
{{/if}}
{{#if imageDataUri}}
{{media url=imageDataUri}}
{{/if}}

Analyze the recipe list and return a clean JSON object according to the output schema.
`,
});

// Define the Genkit flow
const generateProductRecipesFlow = ai.defineFlow(
  {
    name: 'generateProductRecipesFlow',
    inputSchema: GenerateProductRecipesInputSchema,
    outputSchema: GenerateProductRecipesOutputSchema,
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
