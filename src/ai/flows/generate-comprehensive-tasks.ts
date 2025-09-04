
'use server';
/**
 * @fileOverview A flow for generating a comprehensive checklist from text or an image.
 *
 * - generateComprehensiveTasks - A function that handles the task list generation.
 * - GenerateComprehensiveTasksInput - The input type for the generateComprehensiveTasks function.
 * - GenerateComprehensiveTasksOutput - The return type for the generateComprehensiveTasks function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateComprehensiveTasksInputSchema = z.object({
    source: z.enum(['text', 'image']),
    inputText: z.string().optional().describe('A string containing a table of tasks, likely pasted from a spreadsheet.'),
    imageDataUri: z.string().optional().describe("A photo of a task list, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
});
export type GenerateComprehensiveTasksInput = z.infer<typeof GenerateComprehensiveTasksInputSchema>;

const ParsedTaskSchema = z.object({
    text: z.string().describe('The full description of the task.'),
    type: z.enum(['photo', 'boolean', 'opinion']).describe("The type of reporting required for the task. It can be 'photo', 'boolean' (yes/no), or 'opinion' (text feedback)."),
});

const GenerateComprehensiveTasksOutputSchema = z.object({
    tasks: z.array(ParsedTaskSchema).describe('An array of parsed tasks.'),
});
export type GenerateComprehensiveTasksOutput = z.infer<typeof GenerateComprehensiveTasksOutputSchema>;


export async function generateComprehensiveTasks(input: GenerateComprehensiveTasksInput): Promise<GenerateComprehensiveTasksOutput> {
    return generateComprehensiveTasksFlow(input);
}

const prompt = ai.definePrompt({
    name: 'generateComprehensiveTasksPrompt',
    input: { schema: GenerateComprehensiveTasksInputSchema },
    output: { schema: GenerateComprehensiveTasksOutputSchema },
    prompt: `You are an expert data entry assistant for restaurant management. Your task is to analyze the provided input (either text or an image) and extract a list of comprehensive checklist items for a manager.

The input contains a list of inspection items. You must extract the following fields for each item:
- text: The full description of the inspection item.
- type: The type of report needed. Map the input to one of three values: 'photo', 'boolean', or 'opinion'.
    - If the task implies taking a picture, use 'photo'.
    - If the task is a yes/no question or a check for a state (e.g., 'Is it clean?'), use 'boolean'.
    - If the task asks for a subjective assessment or feedback (e.g., 'Evaluate staff attitude'), use 'opinion'.

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

const generateComprehensiveTasksFlow = ai.defineFlow(
    {
        name: 'generateComprehensiveTasksFlow',
        inputSchema: GenerateComprehensiveTasksInputSchema,
        outputSchema: GenerateComprehensiveTasksOutputSchema,
    },
    async (input) => {
        const { output } = await prompt(input);
        return output!;
    }
);
