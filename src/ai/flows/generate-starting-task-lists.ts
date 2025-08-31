'use server';

/**
 * @fileOverview A flow for generating a starting task list from a simple text prompt.
 *
 * - generateStartingTaskList - A function that handles the task list generation process.
 * - GenerateStartingTaskListInput - The input type for the generateStartingTaskList function.
 * - GenerateStartingTaskListOutput - The return type for the generateStartingTaskList function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateStartingTaskListInputSchema = z.object({
  description: z.string().describe('The prompt to generate a task list from.'),
});
export type GenerateStartingTaskListInput = z.infer<typeof GenerateStartingTaskListInputSchema>;

const GenerateStartingTaskListOutputSchema = z.object({
  taskList: z.array(z.string()).describe('The generated task list.'),
});
export type GenerateStartingTaskListOutput = z.infer<typeof GenerateStartingTaskListOutputSchema>;

export async function generateStartingTaskList(
  input: GenerateStartingTaskListInput
): Promise<GenerateStartingTaskListOutput> {
  return generateStartingTaskListFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateStartingTaskListPrompt',
  input: {schema: GenerateStartingTaskListInputSchema},
  output: {schema: GenerateStartingTaskListOutputSchema},
  prompt: `You are an expert task list generator. You will generate a task list based on the prompt provided. The output should be a JSON array of strings.

Prompt: {{{description}}}`,
});

const generateStartingTaskListFlow = ai.defineFlow(
  {
    name: 'generateStartingTaskListFlow',
    inputSchema: GenerateStartingTaskListInputSchema,
    outputSchema: GenerateStartingTaskListOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
