
'use server';
/**
 * @fileOverview A flow for generating a list of bartender tasks from text or an image.
 *
 * - generateBartenderTasks - A function that handles the task list generation.
 * - GenerateBartenderTasksInput - The input type for the generateBartenderTasks function.
 * - GenerateBartenderTasksOutput - The return type for the generateBartenderTasks function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateBartenderTasksInputSchema = z.object({
    source: z.enum(['text', 'image']),
    inputText: z.string().optional().describe('A string containing a table of tasks, likely pasted from a spreadsheet.'),
    imageDataUri: z.string().optional().describe("A photo of a task list, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
});
export type GenerateBartenderTasksInput = z.infer<typeof GenerateBartenderTasksInputSchema>;

const ParsedTaskSchema = z.object({
    text: z.string().describe('The full description of the task.'),
});

const GenerateBartenderTasksOutputSchema = z.object({
    tasks: z.array(ParsedTaskSchema).describe('An array of parsed tasks.'),
});
export type GenerateBartenderTasksOutput = z.infer<typeof GenerateBartenderTasksOutputSchema>;


export async function generateBartenderTasks(input: GenerateBartenderTasksInput): Promise<GenerateBartenderTasksOutput> {
    return generateBartenderTasksFlow(input);
}

const prompt = ai.definePrompt({
    name: 'generateBartenderTasksPrompt',
    input: { schema: GenerateBartenderTasksInputSchema },
    output: { schema: GenerateBartenderTasksOutputSchema },
    prompt: `You are an expert data entry assistant. Your task is to analyze the provided input (either text or an image) and extract a list of tasks for a bartender.

The input contains a list of cleaning or operational tasks. You must extract the following field for each item:
- text: The full description of the task.

Analyze the following input and extract all tasks.

Input:
{{#if inputText}}
\`\`\`
{{{inputText}}}
\`\`\`
{{/if}}
{{#if imageDataUri}}
{{media url=imageDataUri}}
{{/if}}

Return the data as a JSON object matching the prescribed output schema.
`,
});

const generateBartenderTasksFlow = ai.defineFlow(
    {
        name: 'generateBartenderTasksFlow',
        inputSchema: GenerateBartenderTasksInputSchema,
        outputSchema: GenerateBartenderTasksOutputSchema,
    },
    async (input) => {
        const { output } = await prompt(input);
        return output!;
    }
);
