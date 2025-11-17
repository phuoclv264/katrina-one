'use client';

import { app } from './firebase';
import { getFunctions, httpsCallable, Functions } from 'firebase/functions';
import type {
    ExtractRevenueInput,
    ExtractRevenueOutput,
    ExtractInvoiceItemsInput,
    ExtractInvoiceItemsOutput,
    ExtractHandoverDataInput,
    ExtractHandoverDataOutput,
    GenerateDailySummaryInput,
    GenerateDailySummaryOutput,
    GenerateProductRecipesInput,
    GenerateProductRecipesOutput,
    UpdateInventoryItemsInput,
    UpdateInventoryItemsOutput,
    SortTasksInput,
    SortTasksOutput,
    GenerateStartingTaskListInput,
    GenerateStartingTaskListOutput,
    GenerateInventoryListInput,
    GenerateInventoryListOutput,
    GenerateServerTasksInput,
    GenerateServerTasksOutput,
    GenerateBartenderTasksInput,
    GenerateBartenderTasksOutput,
    GenerateComprehensiveTasksInput,
    GenerateComprehensiveTasksOutput,
} from './types';

// Memoize the functions instance
let functions: Functions;
const getFunctionsInstance = () => {
    if (!functions && app) {
        functions = getFunctions(app);
        // You can connect to the emulator here if needed during development
        // import { connectFunctionsEmulator } from 'firebase/functions';
        // if (process.env.NODE_ENV === 'development') {
        //   connectFunctionsEmulator(functions, "localhost", 5001);
        // }
    }
    return functions;
};

/**
 * A generic helper to create a callable function invoker.
 */
function createApiCaller<T, U>(functionName: string) {
    const callable = httpsCallable<T, U>(getFunctionsInstance(), functionName);
    return async (data: T): Promise<U> => {
        const result = await callable(data);
        return result.data;
    };
}

// Export a function for each of your callable AI flows
export const callExtractHandoverData = createApiCaller<ExtractHandoverDataInput, ExtractHandoverDataOutput>('callExtractHandoverData');
export const callExtractInvoiceItems = createApiCaller<ExtractInvoiceItemsInput, ExtractInvoiceItemsOutput>('callExtractInvoiceItems');
export const callExtractRevenueFromImage = createApiCaller<ExtractRevenueInput, ExtractRevenueOutput>('callExtractRevenueFromImage');
export const callGenerateDailySummary = createApiCaller<GenerateDailySummaryInput, GenerateDailySummaryOutput>('callGenerateDailySummary');
export const callGenerateProductRecipes = createApiCaller<GenerateProductRecipesInput, GenerateProductRecipesOutput>('callGenerateProductRecipes');
export const callUpdateInventoryItems = createApiCaller<UpdateInventoryItemsInput, UpdateInventoryItemsOutput>('callUpdateInventoryItems');
export const callSortTasks = createApiCaller<SortTasksInput, SortTasksOutput>('callSortTasks');
export const callGenerateStartingTaskList = createApiCaller<GenerateStartingTaskListInput, GenerateStartingTaskListOutput>('callGenerateStartingTaskList');
export const callGenerateInventoryList = createApiCaller<GenerateInventoryListInput, GenerateInventoryListOutput>('callGenerateInventoryList');
export const callGenerateServerTasks = createApiCaller<GenerateServerTasksInput, GenerateServerTasksOutput>('callGenerateServerTasks');
export const callGenerateBartenderTasks = createApiCaller<GenerateBartenderTasksInput, GenerateBartenderTasksOutput>('callGenerateBartenderTasks');
export const callGenerateComprehensiveTasks = createApiCaller<GenerateComprehensiveTasksInput, GenerateComprehensiveTasksOutput>('callGenerateComprehensiveTasks');
export const callRefineText = createApiCaller<{ title: string; content: string; }, { refinedTitle: string; refinedContent: string; }>('callRefineText');