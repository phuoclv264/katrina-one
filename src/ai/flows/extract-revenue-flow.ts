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
    isReceipt: z.boolean().describe('Whether or not the image is a valid daily sales receipt.'),
    rejectionReason: z.string().optional().describe('The reason why the image was rejected. Provided only if isReceipt is false.'),
    reportTimestamp: z.string().optional().describe('The date and time the report was generated, usually labeled "Ngày giờ". Extract it exactly as seen in "YYYY-MM-DD HH:mm:ss" format.'),
    netRevenue: z.number().optional().describe('The total net revenue amount. This is often labeled as "Doanh thu Net" or a similar term.'),
    orderCount: z.number().optional().describe('The total number of orders. This is often labeled as "Tổng số đơn".'),
    deliveryPartnerPayout: z.number().optional().describe('The amount paid to delivery partners. Look for "Tiền trả ĐTGH" or similar labels.'),
    revenueByPaymentMethod: z.object({
        cash: z.number().describe('Revenue from cash payments. Labeled as "Tiền mặt".'),
        techcombankVietQrPro: z.number().describe('Revenue from Techcombank VietQR Pro. Labeled "Techcombank VietQR Pro".'),
        shopeeFood: z.number().describe('Revenue from ShopeeFood. Labeled "ShopeeFood".'),
        grabFood: z.number().describe('Revenue from GrabFood. Labeled "Grab Food".'),
        bankTransfer: z.number().describe('Revenue from other bank transfers. Labeled "Chuyển Khoản".'),
    }).optional().describe('A breakdown of revenue by each payment method.'),
});

export type ExtractRevenueOutput = z.infer<typeof ExtractRevenueOutputSchema>;


export async function extractRevenueFromImage(input: ExtractRevenueInput): Promise<ExtractRevenueOutput> {
  return extractRevenueFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractRevenuePrompt',
  input: { schema: ExtractRevenueInputSchema },
  output: { schema: ExtractRevenueOutputSchema },
  prompt: `You are a highly intelligent data validation and extraction specialist for a restaurant. Your task is to analyze the provided image and perform a two-step process with extreme accuracy.

**Step 1: Validate the Image**

First, you MUST determine if the image is a valid daily sales report from the POS system. A valid report contains keywords like "Doanh thu Net", "Tổng số đơn", "Tiền mặt", "ShopeeFood", etc.
Then, you MUST assess the image quality. Is it clear enough to read all numbers and text without ambiguity?

*   If the image is NOT a sales report, set \`isReceipt\` to \`false\` and provide a \`rejectionReason\` of "Đây không phải là phiếu thống kê doanh thu."
*   If the image IS a sales report but is too blurry, dark, or unreadable, set \`isReceipt\` to \`false\` and provide a \`rejectionReason\` of "Hình ảnh bị mờ hoặc quá tối, không thể đọc rõ số liệu. Vui lòng chụp lại ảnh rõ nét hơn."

**Step 2: Extract Data (ONLY if Step 1 passes)**

If and only if the image is a valid and clear sales report, set \`isReceipt\` to \`true\` and meticulously extract the following fields. All values must be numbers, without currency symbols or formatting. If a field is not present, omit it or use 0.

1.  **reportTimestamp**: Find the report's generation date and time. Look for a label like "Ngày giờ". Return it as a string in "YYYY-MM-DD HH:mm:ss" format. This is critical.
2.  **netRevenue**: Find the total net revenue. Look for labels like "Doanh thu Net", "Tổng cộng", or "Thực thu".
3.  **orderCount**: Find the total number of orders. Look for "Tổng số đơn", "Số bill", or "Số lượng đơn".
4.  **deliveryPartnerPayout**: Find the amount paid to delivery partners. Look for "Tiền trả ĐTGH".
5.  **revenueByPaymentMethod**: This is an object containing a breakdown of revenue by payment method. You need to find the value for each of the following keys:
    *   **cash**: Find the amount for "Tiền mặt".
    *   **techcombankVietQrPro**: Find the amount for "Techcombank VietQR Pro".
    *   **shopeeFood**: Find the amount for "ShopeeFood".
    *   **grabFood**: Find the amount for "Grab Food".
    *   **bankTransfer**: Find the amount for "Chuyển Khoản".

Analyze the following image and perform your validation and extraction tasks now.

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
    try {
        const { output } = await prompt(input);
        return output!;
    } catch (error: any) {
         if (error.message && error.message.includes('503 Service Unavailable')) {
            console.warn('AI model is overloaded. Retrying in 2 seconds...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            const { output } = await prompt(input);
            return output!;
        }
        throw error;
    }
  }
);
