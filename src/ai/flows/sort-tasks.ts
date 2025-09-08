
'use server';
/**
 * @fileOverview A flow for sorting a list of tasks using AI.
 *
 * - sortTasks - A function that handles the task sorting process.
 * - SortTasksInput - The input type for the sortTasks function.
 * - SortTasksOutput - The return type for the sortTasks function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SortTasksInputSchema = z.object({
  context: z.string().describe('The context or category of the tasks to provide better sorting, e.g., "closing shift for a coffee shop" or "cleaning tasks for a bar area".'),
  tasks: z.array(z.string()).describe('An array of task descriptions to be sorted.'),
  userInstruction: z.string().optional().describe('A specific instruction from the user on how to sort the tasks.'),
});
export type SortTasksInput = z.infer<typeof SortTasksInputSchema>;

const SortTasksOutputSchema = z.object({
  sortedTasks: z.array(z.string()).describe('The array of task descriptions, sorted in a logical order based on the context and user instruction.'),
});
export type SortTasksOutput = z.infer<typeof SortTasksOutputSchema>;

export async function sortTasks(input: SortTasksInput): Promise<SortTasksOutput> {
  return sortTasksFlow(input);
}

const prompt = ai.definePrompt({
  name: 'sortTasksPrompt',
  input: { schema: SortTasksInputSchema },
  output: { schema: SortTasksOutputSchema },
  prompt: `You are an expert restaurant operations manager. Your task is to sort a given list of tasks into a logical and efficient order based on the provided context and a specific user instruction.

Do not add, remove, or modify any tasks. Return the exact same tasks in the 'sortedTasks' array, just in a more logical sequence that follows the user's request.

Context: {{{context}}}

{{#if userInstruction}}
User's Sorting Instruction: "{{{userInstruction}}}"
You MUST follow this instruction.
{{/if}}

Tasks to sort:
{{#each tasks}}
- {{{this}}}
{{/each}}

Return the data as a JSON object matching the prescribed output schema.
`,
});


const sortTasksFlow = ai.defineFlow(
  {
    name: 'sortTasksFlow',
    inputSchema: SortTasksInputSchema,
    outputSchema: SortTasksOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await prompt(input);
      return output!;
    } catch (error: any) {
      // Check for 503 Service Unavailable and retry once.
      if (error.message && error.message.includes('503 Service Unavailable')) {
        console.warn('AI model is overloaded. Retrying in 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        const { output } = await prompt(input);
        return output!;
      }
      // If it's another error, or retry fails, re-throw.
      throw error;
    }
  }
);


