// Summarize Shift Reports
'use server';
/**
 * @fileOverview Summarizes shift reports, checks for critical task completion and photo uploads, and suggests improvements.
 *
 * - summarizeShiftReport - A function that handles the shift report summarization process.
 * - SummarizeShiftReportInput - The input type for the summarizeShiftReport function.
 * - SummarizeShiftReportOutput - The return type for the summarizeShiftReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeShiftReportInputSchema = z.object({
  completedTasks: z.array(z.string()).describe('List of completed tasks during the shift.'),
  uploadedPhotos: z.array(z.string()).describe('List of uploaded photo URLs as proof of task completion.'),
  criticalTasks: z.array(z.string()).describe('List of critical tasks that must be completed.'),
  commonIssues: z.string().describe('Description of common issues encountered during shifts.'),
});

export type SummarizeShiftReportInput = z.infer<typeof SummarizeShiftReportInputSchema>;

const SummarizeShiftReportOutputSchema = z.object({
  summary: z.string().describe('A summary of the shift report, including critical task completion status and photo uploads.'),
  criticalTasksStatus: z.string().describe('Status of critical tasks completion.'),
  photoUploadsStatus: z.string().describe('Status of photo uploads for completed tasks.'),
  suggestedImprovements: z.string().describe('Suggestions for improvements based on common issues.'),
});

export type SummarizeShiftReportOutput = z.infer<typeof SummarizeShiftReportOutputSchema>;

export async function summarizeShiftReport(input: SummarizeShiftReportInput): Promise<SummarizeShiftReportOutput> {
  return summarizeShiftReportFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeShiftReportPrompt',
  input: {schema: SummarizeShiftReportInputSchema},
  output: {schema: SummarizeShiftReportOutputSchema},
  prompt: `You are an AI-powered tool that summarizes shift reports for managers.

You will analyze the completed tasks, uploaded photos, and common issues to provide a comprehensive summary and suggest improvements.

Completed Tasks: {{completedTasks}}
Uploaded Photos: {{uploadedPhotos}}
Critical Tasks: {{criticalTasks}}
Common Issues: {{commonIssues}}

Provide a summary of the shift report, including whether all critical tasks were completed and if photos were uploaded as proof.
Suggest improvements based on the common issues encountered during the shift.

Critical Tasks Status: {{(completedTasks.every(task => criticalTasks.includes(task)) ? 'All critical tasks completed' : 'Not all critical tasks completed')}}
Photo Uploads Status: {{(uploadedPhotos.length > 0 ? 'Photos uploaded' : 'No photos uploaded')}}
Suggested Improvements: Based on the common issues, provide actionable suggestions.`, 
});

const summarizeShiftReportFlow = ai.defineFlow(
  {
    name: 'summarizeShiftReportFlow',
    inputSchema: SummarizeShiftReportInputSchema,
    outputSchema: SummarizeShiftReportOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
