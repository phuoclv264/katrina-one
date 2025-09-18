
'use server';
/**
 * @fileOverview An AI flow to extract structured revenue data from an image of a daily sales report.
 *
 * - extractRevenueFromImage - A function that handles the revenue extraction process.
 * - ExtractRevenueInput - The input type for the extractRevenueFromImage function.
 * - ExtractRevenueOutput - The return type for the extractRevenueFromImage function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExtractRevenueInputSchema = z.object({
  imageDataUri: z.string().describe("A photo of the daily sales report, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
});
export type ExtractRevenueInput = z.infer<typeof ExtractRevenueInputSchema>;

const ExtractRevenueOutputSchema = z.object({
    netRevenue: z.number().describe('The total net revenue amount. This is often labeled as "Doanh thu Net" or a similar term.'),
    orderCount: z.number().describe('The total number of orders. This is often labeled as "Tổng số đơn".'),
    deliveryPartnerPayout: z.number().describe('The amount paid to delivery partners. Look for "Tiền trả ĐTGH" or similar labels.'),
    revenueByPaymentMethod: z.object({
        cash: z.number().describe('Revenue from cash payments. Labeled as "Tiền mặt".'),
        techcombankVietQrPro: z.number().describe('Revenue from Techcombank VietQR Pro. Labeled "Techcombank VietQR Pro".'),
        shopeeFood: z.number().describe('Revenue from ShopeeFood. Labeled "ShopeeFood".'),
        grabFood: z.number().describe('Revenue from GrabFood. Labeled "Grab Food".'),
        bankTransfer: z.number().describe('Revenue from other bank transfers. Labeled "Chuyển Khoản".'),
    }).describe('A breakdown of revenue by each payment method.'),
});

export type ExtractRevenueOutput = z.infer<typeof ExtractRevenueOutputSchema>;


export async function extractRevenueFromImage(input: ExtractRevenueInput): Promise<ExtractRevenueOutput> {
  return extractRevenueFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractRevenuePrompt',
  input: { schema: ExtractRevenueInputSchema },
  output: { schema: ExtractRevenueOutputSchema },
  prompt: `You are a highly accurate data entry specialist for a restaurant. Your task is to analyze the provided image of a daily sales report and extract key financial figures.

The image contains a summary of the day's sales. You must meticulously find and extract the following fields. All values should be numbers, without any currency symbols or formatting.

1.  **netRevenue**: Find the total net revenue. Look for labels like "Doanh thu Net", "Tổng cộng", or "Thực thu".
2.  **orderCount**: Find the total number of orders. Look for "Tổng số đơn", "Số bill", or "Số lượng đơn".
3.  **deliveryPartnerPayout**: Find the amount paid to delivery partners. Look for "Tiền trả ĐTGH".
4.  **revenueByPaymentMethod**: This is an object containing a breakdown of revenue by payment method. You need to find the value for each of the following keys:
    *   **cash**: Find the amount for "Tiền mặt".
    *   **techcombankVietQrPro**: Find the amount for "Techcombank VietQR Pro".
    *   **shopeeFood**: Find the amount for "ShopeeFood".
    *   **grabFood**: Find the amount for "Grab Food".
    *   **bankTransfer**: Find the amount for "Chuyển Khoản".

Carefully examine the following image and extract the data.

{{media url=imageDataUri}}

Return the data as a single, clean JSON object matching the prescribed output schema.
`,
});

const extractRevenueFlow = ai.defineFlow(
  {
    name: 'extractRevenueFlow',
    inputSchema: ExtractRevenueInputSchema,
    outputSchema: ExtractRevenueOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
