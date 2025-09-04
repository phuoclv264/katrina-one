
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
import type { InventoryReport, ShiftReport, TasksByShift, TaskSection, ComprehensiveTaskSection, InventoryItem, CompletionRecord } from '@/lib/types';

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
    prompt: `You are a meticulous and highly analytical Restaurant Operations Director. Your primary task is to review all submitted reports for a specific day and create a single, consolidated, and insightful summary for the Restaurant Owner.

Your summary MUST be in Vietnamese and formatted using clear, professional Markdown. Use headings, bold text, bullet points, and blockquotes to make the summary easy to digest.

Here is the complete data for the date: {{{date}}}

**1. All Submitted Reports for the day:**
\`\`\`json
{{{json reports}}}
\`\`\`

**2. All Task & Item Definitions (for reference and comparison):**
\`\`\`json
{{{json taskDefinitions}}}
\`\`\`

**Your Summary Must Cover the Following Areas in Detail:**

### 🚨 Báo cáo Phục vụ

**1. Công việc chưa hoàn thành:**
- Iterate through each shift ('sang', 'trua', 'toi') in \`taskDefinitions.serverTasks\`.
- For each task in each shift, check if there is a corresponding entry in any of the submitted 'server' reports (reports with \`shiftKey\` matching 'sang', 'trua', 'toi').
- If a task has no completion record across all submitted reports for that day, list it here under its shift name. If all tasks for a shift were completed, state that.

**2. Theo dõi công việc Quan trọng:**
- Find all tasks in \`taskDefinitions.serverTasks\` where \`isCritical\` is true.
- For each critical task, scan all submitted server reports.
- If a critical task was completed, list it here. For each completion, you MUST specify:
    - Who performed it (\`staffName\`).
    - At what time (\`timestamp\` from the \`completionRecord\`).
- If a critical task was NOT completed, state that clearly.

**3. Ghi chú từ Nhân viên:**
- Scan all 'server' reports for the \`issues\` field.
- If the \`issues\` field contains text, quote it directly in a blockquote, mentioning which staff member wrote it and for which shift.

### 📋 Báo cáo Toàn diện của Quản lý

**1. Các hạng mục "Không Đảm bảo":**
- Scan the 'manager_comprehensive' reports.
- For each task completion record where \`value\` is \`false\`, list the task's text (\`task.text\`) and the time it was recorded (\`completion.timestamp\`).
- After listing it, you MUST check if a LATER completion record for the SAME task exists with a \`value\` of \`true\`.
    - If yes, state "=> Đã được khắc phục."
    - If no, state "=> Chưa được khắc phục."

**2. Ghi nhận & Ý kiến từ Quản lý:**
- Scan the 'manager_comprehensive' reports for any completions of tasks with \`type: 'opinion'\`.
- If a completion has an \`opinion\` text, quote it directly in a blockquote, mentioning who recorded it and at what time.
- Also, scan for any general \`issues\` noted in the main report body and quote them.

### 📦 Tồn kho & Đặt hàng
- Look at the 'inventory' report.
- Briefly summarize the AI's ordering suggestion from the \`suggestions.summary\` field.
- Do NOT list every single item to order. Just provide the main summary text.

Generate the summary now. Be thorough, clear, and professional. Structure your response to be an actionable intelligence report for the owner.
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
