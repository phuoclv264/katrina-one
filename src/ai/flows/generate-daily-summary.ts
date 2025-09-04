
'use server';
/**
 * @fileOverview A flow for generating a comprehensive daily summary from all submitted reports.
 *
 * - generateDailySummary - A function that handles the summary generation.
 * - GenerateDailySummaryInput - The input type for the generateDailySummary function.
 * - GenerateDailySummaryOutput - The return type for the generateDailySummary function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { InventoryReport, ShiftReport, TasksByShift, TaskSection, ComprehensiveTaskSection, InventoryItem } from '@/lib/types';

const GenerateDailySummaryInputSchema = z.object({
    date: z.string().describe("The date for which the summary is being generated, in YYYY-MM-DD format."),
    reports: z.any().describe("An array containing all report objects for the given day. This includes shift reports, hygiene reports, inventory reports, etc."),
    taskDefinitions: z.object({
        serverTasks: z.custom<TasksByShift>(),
        bartenderTasks: z.custom<TaskSection[]>(),
        comprehensiveTasks: z.custom<ComprehensiveTaskSection[]>(),
        inventoryItems: z.custom<InventoryItem[]>(),
    }).describe("An object containing the full definition of all possible tasks and items for comparison."),
});

export type GenerateDailySummaryInput = z.infer<typeof GenerateDailySummaryInputSchema>;

const GenerateDailySummaryOutputSchema = z.object({
    summary: z.string().describe('A comprehensive summary of the day\'s reports, formatted in Markdown.'),
});
export type GenerateDailySummaryOutput = z.infer<typeof GenerateDailySummaryOutputSchema>;


export async function generateDailySummary(input: GenerateDailySummaryInput): Promise<GenerateDailySummaryOutput> {
    return generateDailySummaryFlow(input);
}

const prompt = ai.definePrompt({
    name: 'generateDailySummaryPrompt',
    input: { schema: GenerateDailySummaryInputSchema },
    output: { schema: GenerateDailySummaryOutputSchema },
    prompt: `You are a highly efficient and observant restaurant Operations Manager. Your task is to review all the reports submitted for a specific day and create a single, consolidated summary for the Restaurant Owner.

Your summary MUST be in Vietnamese and formatted using Markdown. Use headings, bold text, bullet points, and blockquotes to make the summary clear, concise, and easy to read.

Here is the data for the date: {{{date}}}

**1. All Submitted Reports for the day:**
\`\`\`json
{{{json reports}}}
\`\`\`

**2. All Task & Item Definitions (for checking completeness):**
\`\`\`json
{{{json taskDefinitions}}}
\`\`\`

**Your Summary Must Cover the Following Areas:**

### 📝 Công việc chưa hoàn thành
- Go through each submitted report ('serverTasks', 'bartender_hygiene', 'manager_comprehensive').
- For each report, compare the 'completedTasks' against the full list of tasks in 'taskDefinitions'.
- List any tasks that were NOT completed. Group them by report type (e.g., "Checklist Ca Sáng", "Báo cáo Vệ sinh quầy"). If all tasks in a report were completed, state that.

### ❗️ Vấn đề & Ghi chú đáng chú ý
- Scan ALL reports for the 'issues' field. If it contains text, quote it directly in your summary.
- Scan the 'manager_comprehensive' report for any 'opinion' type tasks that have a value. Quote the opinion.
- Scan the 'manager_comprehensive' report for any 'boolean' type tasks that are marked as 'false' (không đảm bảo). Highlight these as noteworthy issues.

### 📦 Tồn kho & Đặt hàng
- Look at the 'inventory' report.
- Briefly summarize the AI's ordering suggestion from the 'suggestions.summary' field.
- Do NOT list every single item to order. Just provide the main summary text.

### ✨ Tổng kết chung
- Provide a brief, one or two-sentence overall assessment of the day's operations based on the data.

Generate the summary now. Be thorough, clear, and professional.
`,
});

const generateDailySummaryFlow = ai.defineFlow(
    {
        name: 'generateDailySummaryFlow',
        inputSchema: GenerateDailySummaryInputSchema,
        outputSchema: GenerateDailySummaryOutputSchema,
    },
    async (input) => {
        const { output } = await prompt(input);
        return output!;
    }
);
