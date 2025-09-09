
'use server';
/**
 * @fileOverview A flow for generating a list of server tasks from text or an image.
 *
 * - generateServerTasks - A function that handles the task list generation.
 * - GenerateServerTasksInput - The input type for the generateServerTasks function.
 * - GenerateServerTasksOutput - The return type for the generateServerTasks function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateServerTasksInputSchema = z.object({
    source: z.enum(['text', 'image']),
    inputText: z.string().optional().describe('A string containing a table of tasks, likely pasted from a spreadsheet.'),
    imageDataUri: z.string().optional().describe("A photo of a task list, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
});
export type GenerateServerTasksInput = z.infer<typeof GenerateServerTasksInputSchema>;

const ParsedTaskSchema = z.object({
    text: z.string().describe('The full description of the task.'),
    isCritical: z.boolean().describe('Whether the task is considered critical.'),
    type: z.enum(['photo', 'boolean', 'opinion']).describe("The type of reporting required for the task. It can be 'photo', 'boolean' (yes/no), or 'opinion' (text feedback)."),
});

const GenerateServerTasksOutputSchema = z.object({
    tasks: z.array(ParsedTaskSchema).describe('An array of parsed tasks.'),
});
export type GenerateServerTasksOutput = z.infer<typeof GenerateServerTasksOutputSchema>;


export async function generateServerTasks(input: GenerateServerTasksInput): Promise<GenerateServerTasksOutput> {
    return generateServerTasksFlow(input);
}

const prompt = ai.definePrompt({
    name: 'generateServerTasksPrompt',
    input: { schema: GenerateServerTasksInputSchema },
    output: { schema: GenerateServerTasksOutputSchema },
    prompt: `You are an expert data entry assistant for restaurant staff. Your task is to analyze the provided input (either text or an image) and extract a list of tasks for a server.

The input contains a list of tasks. You must extract the following fields for each item:
- text: The full description of the task.
- isCritical: A boolean indicating if the task is critical. Tasks marked with "quan trọng", "critical", or similar terms should be considered critical.
- type: The type of report needed. Map the input to one of three values: 'photo', 'boolean', or 'opinion'.
    - If the task implies taking a picture or visually verifying something, use 'photo'.
    - If the task is a yes/no question or a check for a state (e.g., 'Is it clean?'), use 'boolean'.
    - If the task asks for a subjective assessment or feedback (e.g., 'Evaluate staff attitude'), use 'opinion'.
    - If not specified, default to 'photo'.

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

const generateServerTasksFlow = ai.defineFlow(
    {
        name: 'generateServerTasksFlow',
        inputSchema: GenerateServerTasksInputSchema,
        outputSchema: GenerateServerTasksOutputSchema,
    },
    async (input) => {
        const { output } = await prompt(input);
        return output!;
    }
);
