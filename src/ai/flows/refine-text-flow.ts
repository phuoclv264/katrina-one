'use server';
/**
 * @fileOverview An AI flow to refine user-provided text to be more polite and clear.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const RefineTextInputSchema = z.object({
  title: z.string().describe('The title of the report.'),
  content: z.string().describe('The main content of the report.'),
});

const RefineTextOutputSchema = z.object({
  refinedTitle: z.string().describe('The improved, more professional version of the title.'),
  refinedContent: z.string().describe('The improved, more professional version of the content.'),
});

const refineTextPrompt = ai.definePrompt(
  {
    name: 'refineTextPrompt',
    input: { schema: RefineTextInputSchema },
    output: { schema: RefineTextOutputSchema },
    prompt: `Hãy đóng vai một trợ lý ngôn ngữ chuyên nghiệp. Sửa lỗi chính tả và ngữ pháp cho tiêu đề và nội dung sau đây, thêm kính ngữ để lịch sự hơn nhưng phải giữ nguyên ý nghĩa gốc. Chỉ trả về một đối tượng JSON với hai khóa: "refinedTitle" và "refinedContent".

Văn bản gốc:
### TIÊU ĐỀ
{{{title}}}

### NỘI DUNG
{{{content}}}
`,
  },
);

export async function refineText(input: { title: string; content: string }): Promise<{ refinedTitle: string; refinedContent: string; }> {
  try {
    const { output } = await refineTextPrompt(input);
    if (!output) {
      throw new Error("AI did not return a valid response.");
    }
    return output;
  } catch (error: any) {
    console.error('AI text refinement failed:', error);
    // In case of AI failure, return the original text to avoid breaking the user flow.
    return { refinedTitle: input.title, refinedContent: input.content };
  }
}
