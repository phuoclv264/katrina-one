'use client';

import React from 'react';
import OwnerExpenseSlipDialog from './owner-expense-slip-dialog';
import OwnerRevenueStatsDialog from './owner-revenue-stats-dialog';
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
}) => {
    return (
        <>
            <OwnerExpenseSlipDialog
                open={isExpenseDialogOpen}
                onOpenChange={setIsExpenseDialogOpen}
                onSave={handleSaveSlip}
                isProcessing={isProcessing}
                slipToEdit={slipToEdit}
                inventoryList={inventoryList}
                otherCostCategories={otherCostCategories}
            />
            <OwnerRevenueStatsDialog
                open={isRevenueDialogOpen}
                onOpenChange={setIsRevenueDialogOpen}
                onSave={handleSaveRevenue}
                isProcessing={isProcessing}
                existingStats={revenueStatsToEdit}
            />
        </>
    );
});
OwnerCashierDialogs.displayName = 'OwnerCashierDialogs';

export default OwnerCashierDialogs;
