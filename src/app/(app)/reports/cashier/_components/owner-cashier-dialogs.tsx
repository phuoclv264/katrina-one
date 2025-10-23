
'use client';

import React from 'react';
import ExpenseSlipDialog from '../../../cashier/_components/expense-slip-dialog';
import RevenueStatsDialog from '../../../cashier/_components/revenue-stats-dialog';
import type { InventoryItem, OtherCostCategory } from '@/lib/types';


const OwnerCashierDialogs = React.memo(({
    inventoryList,
    isExpenseDialogOpen,
    setIsExpenseDialogOpen,
    handleSaveSlip,
    isProcessing,
    slipToEdit,
    isRevenueDialogOpen,
    setIsRevenueDialogOpen,
    handleSaveRevenue,
    revenueStatsToEdit,
    otherCostCategories,
    dateForNewEntry,
    reporter,
}: {
    inventoryList: InventoryItem[],
    isExpenseDialogOpen: boolean,
    setIsExpenseDialogOpen: (open: boolean) => void,
    handleSaveSlip: (data: any, id?: string) => void,
    isProcessing: boolean,
    slipToEdit: any,
    isRevenueDialogOpen: boolean,
    setIsRevenueDialogOpen: (open: boolean) => void,
    handleSaveRevenue: (data: any, isEdited: boolean) => void,
    revenueStatsToEdit: any,
    otherCostCategories: OtherCostCategory[],
    dateForNewEntry: string | null,
    reporter: any,
}) => {
    return (
        <>
            <ExpenseSlipDialog
                open={isExpenseDialogOpen}
                onOpenChange={setIsExpenseDialogOpen}
                onSave={handleSaveSlip}
                isProcessing={isProcessing}
                slipToEdit={slipToEdit}
                inventoryList={inventoryList}
                reporter={slipToEdit?.createdBy || reporter}
                otherCostCategories={otherCostCategories}
                isOwnerView={true}
                dateForNewEntry={dateForNewEntry}
            />
            <RevenueStatsDialog
                open={isRevenueDialogOpen}
                onOpenChange={setIsRevenueDialogOpen}
                onSave={handleSaveRevenue}
                isProcessing={isProcessing}
                existingStats={revenueStatsToEdit}
                isOwnerView={true}
                reporter={reporter}
                dateForNewEntry={dateForNewEntry}
            />
        </>
    );
});
OwnerCashierDialogs.displayName = 'OwnerCashierDialogs';

export default OwnerCashierDialogs;
