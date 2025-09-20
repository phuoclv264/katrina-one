
'use client';

import React from 'react';
import ExpenseSlipDialog from './expense-slip-dialog';
import IncidentReportDialog from './incident-report-dialog';
import RevenueStatsDialog from './revenue-stats-dialog';

const CashierDialogs = React.memo(({
    user,
    inventoryList,
    isExpenseDialogOpen,
    setIsExpenseDialogOpen,
    handleSaveSlip,
    isProcessing,
    slipToEdit,
    isIncidentDialogOpen,
    setIsIncidentDialogOpen,
    handleSaveIncident,
    isRevenueDialogOpen,
    setIsRevenueDialogOpen,
    handleSaveRevenue,
    revenueStats
}: any) => {
    return (
        <>
            <ExpenseSlipDialog
                open={isExpenseDialogOpen}
                onOpenChange={setIsExpenseDialogOpen}
                onSave={handleSaveSlip}
                isProcessing={isProcessing}
                slipToEdit={slipToEdit}
                inventoryList={inventoryList}
                reporter={user}
            />
            <IncidentReportDialog
                open={isIncidentDialogOpen}
                onOpenChange={setIsIncidentDialogOpen}
                onSave={handleSaveIncident}
                isProcessing={isProcessing}
            />
            <RevenueStatsDialog
                open={isRevenueDialogOpen}
                onOpenChange={setIsRevenueDialogOpen}
                onSave={handleSaveRevenue}
                isProcessing={isProcessing}
                existingStats={revenueStats}
            />
        </>
    );
});
CashierDialogs.displayName = 'CashierDialogs';

export default CashierDialogs;
