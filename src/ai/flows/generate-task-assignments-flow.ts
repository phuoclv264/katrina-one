'use server';
/**
 * @fileOverview An AI flow to generate a balanced monthly task assignment schedule.
 *
 * - generateTaskAssignments - The main function to call the flow.
 * - GenerateTaskAssignmentsInput - Input schema for the flow.
 * - GenerateTaskAssignmentsOutput - Output schema for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { MonthlyTask, ManagedUser, Schedule, AssignedUser } from '@/lib/types';

const AssignmentSchema = z.object({
  taskId: z.string().describe("The ID of the task being assigned."),
  taskName: z.string().describe("The name of the task being assigned."),
  assignedTo: z.object({
      userId: z.string(),
      userName: z.string(),
  }).describe("The user this task is assigned to."),
  assignedDate: z.string().describe("The date the task should be performed, in YYYY-MM-DD format."),
});

const GenerateTaskAssignmentsInputSchema = z.object({
  month: z.string().describe("The month for which to generate assignments, in YYYY-MM format."),
  allTasks: z.custom<MonthlyTask[]>().describe("The list of all available monthly tasks to be assigned."),
  allUsers: z.custom<ManagedUser[]>().describe("The list of all employees available for assignment."),
  allSchedules: z.custom<Schedule[]>().describe("A list of all weekly schedules for the given month, which includes shift assignments."),
});
export type GenerateTaskAssignmentsInput = z.infer<typeof GenerateTaskAssignmentsInputSchema>;


const GenerateTaskAssignmentsOutputSchema = z.object({
  assignments: z.array(AssignmentSchema).describe("An array of task assignments for the month."),
});
export type GenerateTaskAssignmentsOutput = z.infer<typeof GenerateTaskAssignmentsOutputSchema>;

export async function generateTaskAssignments(input: GenerateTaskAssignmentsInput): Promise<GenerateTaskAssignmentsOutput> {
  return generateTaskAssignmentsFlow(input);
}


const prompt = ai.definePrompt({
  name: 'generateTaskAssignmentsPrompt',
  input: { schema: GenerateTaskAssignmentsInputSchema },
  output: { schema: GenerateTaskAssignmentsOutputSchema },
  prompt: `You are an expert, fair, and logical Operations Manager for a coffee shop. Your goal is to create a monthly recurring task schedule for all employees for the month of {{{month}}}.

You will be given a list of all tasks, a list of all employees, and all the weekly work schedules for the month.

**Your output MUST be a valid JSON object containing a single key "assignments", which is an array of assignment objects.**

**CRITICAL RULES FOR ASSIGNMENT:**

1.  **Task Fulfillment:** You MUST assign EACH task the exact number of times specified by its 'frequency' property for the given month. For example, a task with \`{ type: 'per_month', count: 2 }\` must be assigned exactly twice. A task with \`{ type: 'per_week', count: 1 }\` must be assigned approximately 4 times in a month.

2.  **Role-Based Assignment:** A task MUST only be assigned to an employee whose 'role' or 'secondaryRoles' matches the task's 'appliesToRole'. This is a strict constraint.

3.  **Workday Assignment:** A task MUST only be assigned to a user on a day they are scheduled to work. You MUST verify this against the provided schedules.

4.  **Workload Balancing (Most Important):** Distribute the total estimated task time as evenly as possible among eligible employees. Calculate the total working hours for each employee for the entire month from the provided schedules. Assign more total task time to employees who work more hours. The goal is fairness.

5.  **Task Spacing:** For tasks that occur more than once a month, you MUST space them out evenly throughout the month. For example, a weekly task should be assigned roughly once every 7 days. A task that occurs twice a month should have its two assignments about 15 days apart.

**INPUT DATA:**

**1. All Tasks to be Assigned:**
\`\`\`json
{{{json allTasks}}}
\`\`\`

**2. All Available Employees:**
\`\`\`json
{{{json allUsers}}}
\`\`\`

**3. All Weekly Work Schedules for the Month:**
\`\`\`json
{{{json allSchedules}}}
\`\`\`

Based on all the data and rules above, generate the optimal task assignment schedule now.
`,
});


const generateTaskAssignmentsFlow = ai.defineFlow(
  {
    name: 'generateTaskAssignmentsFlow',
    inputSchema: GenerateTaskAssignmentsInputSchema,
    outputSchema: GenerateTaskAssignmentsOutputSchema,
  },
  async (input) => {
    try {
        const { output } = await prompt(input);
        return output!;
    } catch (error: any) {
        console.error("AI task assignment generation failed:", error);
        if (error.message && (error.message.includes('503 Service Unavailable') || error.message.includes('429 Too Many Requests'))) {
            throw new Error('Máy chủ AI đang quá tải. Vui lòng thử lại sau vài phút.');
        }
        throw new Error('AI không thể tạo lịch phân công. Vui lòng kiểm tra lại dữ liệu đầu vào.');
    }
  }
);
