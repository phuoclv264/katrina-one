'use server';
/**
 * @fileOverview An AI flow to extract structured data from an end-of-shift handover receipt.
 *
 * - extractHandoverData - A function that handles the data extraction process.
 * - ExtractHandoverDataInput - The input type for the extractHandoverData function.
 * - ExtractHandoverDataOutput - The return type for the extractHandoverData function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExtractHandoverDataInputSchema = z.object({
  imageDataUri: z.string().describe("A photo of the handover receipt, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
});
export type ExtractHandoverDataInput = z.infer<typeof ExtractHandoverDataInputSchema>;

const ExtractHandoverDataOutputSchema = z.object({
    isReceipt: z.boolean().describe('Whether or not the image is a valid handover receipt.'),
    rejectionReason: z.string().optional().describe('The reason why the image was rejected. Provided only if isReceipt is false.'),
    shiftEndTime: z.string().optional().describe('The end time of the shift, usually at the bottom. You MUST extract it exactly as seen and return it in "YYYY-MM-DD HH:mm:ss" format. This is the most critical field.'),
    
    expectedCash: z.number().optional().describe('The expected cash amount. Labeled "Tiền mặt dự kiến".'),
    startOfDayCash: z.number().optional().describe('The cash amount at the start of the day. Labeled "Tiền mặt đầu ca".'),
    cashExpense: z.number().optional().describe('Cash expenses. Labeled "Chi tiền" under "Phương thức tiền mặt".'),
    cashRevenue: z.number().optional().describe('Total cash revenue. Labeled "Doanh thu tiền mặt".'),
    deliveryPartnerPayout: z.number().optional().describe('The amount paid to delivery partners from non-cash methods. Labeled "Tiền trả ĐTGH" under "Phương thức khác".'),
    cashRefund: z.number().optional().describe('Refunds made in cash. Labeled "Tiền hoàn/ huỷ" under "Phương thức tiền mặt".'),
    otherRefund: z.number().optional().describe('Refunds made via other methods. Labeled "Tiền hoàn/ huỷ" under "Phương thức khác".'),
    
    revenueByCard: z.object({
        techcombankVietQrPro: z.number().optional().describe('Revenue from Techcombank VietQR Pro. Labeled "Techcombank VietQR Pro".'),
        shopeeFood: z.number().optional().describe('Revenue from ShopeeFood. Labeled "ShopeeFood".'),
        grabFood: z.number().optional().describe('Revenue from GrabFood. Labeled "Grab Food".'),
        bankTransfer: z.number().optional().describe('Revenue from other bank transfers. Labeled "Chuyển Khoản".'),
    }).optional().describe('A breakdown of revenue from card/transfer methods.'),
});

export type ExtractHandoverDataOutput = z.infer<typeof ExtractHandoverDataOutputSchema>;


export async function extractHandoverData(input: ExtractHandoverDataInput): Promise<ExtractHandoverDataOutput> {
  return extractHandoverDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractHandoverPrompt',
  input: { schema: ExtractHandoverDataInputSchema },
  output: { schema: ExtractHandoverDataOutputSchema },
  prompt: `You are an expert OCR and data extraction specialist for restaurant end-of-shift handover reports ("Phiếu bàn giao"). Your task is to analyze the provided image with extreme accuracy.

**Step 1: Validate the Image**
First, you MUST determine if the image is a valid "Phiếu bàn giao". It must contain this exact title.
Then, assess the image quality. Is it clear enough to read all numbers and text without ambiguity?

*   If the image is NOT a "Phiếu bàn giao", set \`isReceipt\` to \`false\` and provide a \`rejectionReason\` of "Đây không phải là phiếu bàn giao."
*   If the image IS a handover receipt but is too blurry, dark, or unreadable, set \`isReceipt\` to \`false\` and provide a \`rejectionReason\` of "Hình ảnh bị mờ hoặc quá tối, không thể đọc rõ số liệu. Vui lòng chụp lại ảnh rõ nét hơn."

**Step 2: Extract Data (ONLY if Step 1 passes)**
If and only if the image is a valid and clear receipt, set \`isReceipt\` to \`true\` and meticulously extract the following fields. All values must be numbers, without currency symbols or formatting. If a field is not present, omit it or use 0.

1.  **shiftEndTime**: CRITICAL. This is the MOST IMPORTANT field. Find the timestamp at the VERY BOTTOM of the receipt. You MUST return it as a string in "YYYY-MM-DD HH:mm:ss" format. If you cannot find this field or it's unreadable, you MUST return null for this field.
2.  **expectedCash**: Find "Tiền mặt dự kiến" in the "Tổng quan" section.
3.  **startOfDayCash**: Find "Tiền mặt đầu ca" in the "Phương thức tiền mặt" section.
4.  **cashExpense**: Find "Chi tiền" in the "Phương thức tiền mặt" section.
5.  **cashRevenue**: Find "Doanh thu tiền mặt" in the "Phương thức tiền mặt" section.
6.  **deliveryPartnerPayout**: Find "Tiền trả ĐTGH" in the "Phương thức khác" section.
7.  **revenueByCard**: This is an object. You need to find the values for the following payment methods, which are usually under "Phương thức khác" section:
8.  **cashRefund**: Find "Tiền hoàn/ huỷ" in the "Phương thức tiền mặt" section.
9.  **otherRefund**: Find "Tiền hoàn/ huỷ" in the "Phương thức khác" section.
    *   **techcombankVietQrPro**: Find "Techcombank VietQR Pro".
    *   **shopeeFood**: Find "ShopeeFood".
    *   **grabFood**: Find "Grab Food".
    *   **bankTransfer**: Find "Chuyển Khoản".

Analyze the following image and perform your validation and extraction tasks now.

{{media url=imageDataUri}}

Return the data as a single, clean JSON object matching the prescribed output schema.
`,
});

const extractHandoverDataFlow = ai.defineFlow(
  {
    name: 'extractHandoverDataFlow',
    inputSchema: ExtractHandoverDataInputSchema,
    outputSchema: ExtractHandoverDataOutputSchema,
  },
  async (input) => {
    try {
        const { output } = await prompt(input);
        return output!;
    } catch (error: any) {
         if (error.message && (error.message.includes('503 Service Unavailable') || error.message.includes('429 Too Many Requests'))) {
            console.warn('AI model is overloaded. Retrying...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            const { output } = await prompt(input);
            return output!;
        }
        throw error;
    }
  }
);
