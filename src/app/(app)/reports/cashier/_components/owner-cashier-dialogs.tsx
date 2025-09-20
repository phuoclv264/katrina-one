'use client';

import React from 'react';
import OwnerExpenseSlipDialog from './owner-expense-slip-dialog';
import OwnerRevenueStatsDialog from './owner-revenue-stats-dialog';

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
    revenueStatsToEdit
}: any) => {
    return (
        <>
            <OwnerExpenseSlipDialog
                open={isExpenseDialogOpen}
                onOpenChange={setIsExpenseDialogOpen}
                onSave={handleSaveSlip}
                isProcessing={isProcessing}
                slipToEdit={slipToEdit}
                inventoryList={inventoryList}
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
