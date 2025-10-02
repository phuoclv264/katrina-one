
'use server';
/**
 * @fileOverview An AI flow to parse product recipes from text or an image and link them to inventory items.
 *
 * - generateProductRecipes - A function that handles the recipe parsing and linking.
 * - ParsedProduct - The structure of a single parsed product.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { InventoryItem, Product } from '@/lib/types';

// Define Zod schema for a single ingredient
const ProductIngredientSchema = z.object({
  inventoryItemId: z.string().nullable().describe("The ID of the matched inventory item. Null if not an inventory item."),
  productId: z.string().nullable().describe("The ID of the matched sub-product. Null if not a sub-product."),
  name: z.string().describe("The original name of the ingredient as it appeared in the source text."),
  quantity: z.number().describe("The numeric quantity of the ingredient."),
  unit: z.string().describe("The unit of measurement for the quantity (e.g., 'ml', 'g', 'viên')."),
  isMatched: z.boolean().describe("True if a confident match was found in the inventory or product list, otherwise false."),
});

// Define Zod schema for a single product (recipe)
const ParsedProductSchema = z.object({
  name: z.string().describe("The full name of the product, e.g., 'ESPRESSO (CÀ PHÊ ĐEN PHA MÁY)'."),
  category: z.string().describe("The category of the product, e.g., 'ESPRESSO', 'TRÀ SỮA'."),
  ingredients: z.array(ProductIngredientSchema).describe("An array of all ingredients for this product."),
  isIngredient: z.boolean().describe("Whether this product can be used as an ingredient in other recipes. Always default to false.").optional(),
  yield: z.object({
    quantity: z.number().describe("The total quantity of the final product yielded by this recipe."),
    unit: z.string().describe("The unit for the yield quantity, e.g., 'ml', 'g'."),
  }).optional().describe("The total amount of finished product this recipe makes."),
  note: z.string().optional().describe("Any preparation notes or instructions associated with the product."),
});
export type ParsedProduct = z.infer<typeof ParsedProductSchema>;


// Define Zod schema for the AI flow's input
const GenerateProductRecipesInputSchema = z.object({
  inputText: z.string().optional().describe("A string containing the list of recipes, likely pasted from a document."),
  imageDataUri: z.string().optional().describe("An image of the recipe list, as a data URI."),
  inventoryItems: z.custom<InventoryItem[]>().describe("The complete list of current inventory items to match against."),
  allProducts: z.custom<Product[]>().describe("A list of all other existing products to check for sub-recipes."),
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

You will be given a list of available inventory items and other products to match against the ingredients in the recipes.

**General Guidelines:**

1.  **Identify Products:** Look for lines that start with a number and a name in all caps, like "1. ESPRESSO (CÀ PHÊ ĐEN PHA MÁY)". These are the products.

2.  **Extract Product Details:** For each product, try to extract the following:
    *   'name': The full name of the product.
    *   'category': Try to infer the category from the product name or surrounding context (e.g., 'ESPRESSO', 'TRÀ SỮA'). If you can't, make a reasonable guess.
    *   'note': Any text in parentheses '()' that seems like instructions should be the 'note'.
    *   'ingredients': A list of all ingredients for that product.
    *   'isIngredient': Always set this to 'false'.
    *   'yield': This is optional. Only fill this if the notes clearly state the total output volume, like "thu được 450ml cốt cà phê" -> { quantity: 450, unit: 'ml' }.

3.  **Parse Ingredients:** For each ingredient line (usually starting with '-'):
    *   Extract the 'name', 'quantity' (number), and 'unit' (e.g., 'ml', 'g').

4.  **Match Ingredients:** For each ingredient you parse:
    *   First, try to find a match in the 'allProducts' list. A good match is when the ingredient name is very similar to a product name.
    *   If you find a product match, set 'isMatched' to 'true' and put its ID in 'productId'.
    *   If no product matches, then search the 'inventoryItems' list. Use fuzzy matching (e.g., "Sữa đặc NSPN" should match "Sữa đặc").
    *   If you find an inventory match, set 'isMatched' to 'true' and put its 'id' in 'inventoryItemId'.
    *   **If you cannot find a confident match in either list, that's okay. Just set 'isMatched' to 'false' and move on.** Don't stop or return an error.

**Input Data:**

**Available Inventory Items:**
{{{json inventoryItems}}}

**Available Products (for sub-recipe matching):**
{{{json allProducts}}}

**Recipe List (from text or image):**
{{#if inputText}}
---
{{{inputText}}}
---
{{/if}}
{{#if imageDataUri}}
{{media url=imageDataUri}}
{{/if}}

Analyze the recipe list and return a clean JSON object according to the output schema. Just return your best effort based on the information you can parse.
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
    let attempt = 0;
    const maxAttempts = 2;
    
    while (attempt < maxAttempts) {
        try {
            const { output } = await prompt(input);
            if (!output || !Array.isArray(output.products)) {
                throw new Error('AI did not return a valid product list.');
            }
            return output;
        } catch (error: any) {
            attempt++;
            console.error(`Attempt ${attempt} failed:`, error);

            if (attempt >= maxAttempts) {
                let userFriendlyMessage = 'AI đã gặp lỗi không xác định sau nhiều lần thử. Vui lòng thử lại sau.';
                if (error.message) {
                    if (error.message.includes('503') || error.message.includes('429')) {
                        userFriendlyMessage = 'Máy chủ AI đang quá tải. Vui lòng thử lại sau vài phút.';
                    } else if (error.message.includes('valid product list')) {
                         userFriendlyMessage = 'AI không trả về được dữ liệu hợp lệ. Vui lòng kiểm tra lại định dạng văn bản đầu vào và thử lại.';
                    }
                }
                throw new Error(userFriendlyMessage);
            }

            if (error.message && (error.message.includes('503') || error.message.includes('429'))) {
                console.warn(`AI model is overloaded. Retrying in ${attempt * 2} seconds...`);
                await new Promise(resolve => setTimeout(resolve, attempt * 2000));
            } else {
                // For other errors, retry immediately without a long delay
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }
    // This line should not be reachable, but is a fallback.
    throw new Error('Không thể phân tích công thức sau nhiều lần thử.');
  }
);

    