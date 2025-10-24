
'use client';

import React from 'react';
import ExpenseSlipDialog from '../../../cashier/_components/expense-slip-dialog';
import IncidentReportDialog from '../../../cashier/_components/incident-report-dialog';
import RevenueStatsDialog from '../../../cashier/_components/revenue-stats-dialog';
import CashHandoverDialog from '../../../cashier/_components/cash-handover-dialog';
import HandoverDialog from '../../../cashier/_components/handover-dialog';

import type { InventoryItem, OtherCostCategory, IncidentCategory, RevenueStats, ExpenseSlip, CashHandoverReport, FinalHandoverDetails } from '@/lib/types';


const OwnerCashierDialogs = React.memo(({
    inventoryList,
    isExpenseDialogOpen,
    setIsExpenseDialogOpen,
    handleSaveSlip,
    isProcessing,
    processingItemId,
    slipToEdit,
    isRevenueDialogOpen,
    setIsRevenueDialogOpen,
    handleSaveRevenue,
    revenueStatsToEdit,
    otherCostCategories,
    isIncidentDialogOpen,
    setIsIncidentDialogOpen,
    handleSaveIncident,
    incidentToEdit,
    incidentCategories,
    handleCategoriesChange,
    canManageCategories,
    isCashHandoverDialogOpen,
    setIsCashHandoverDialogOpen,
    handleSaveCashHandover,
    cashHandoverToEdit,
    expectedCashForDialog,
    linkedRevenueForDialog,
    linkedExpensesForDialog,
    isFinalHandoverViewOpen,
    setIsFinalHandoverViewOpen,
    handleUpdateFinalHandover,
    finalHandoverToView,
    dateForNewEntry,
    reporter,
}: {
    inventoryList: InventoryItem[],
    isExpenseDialogOpen: boolean,
    setIsExpenseDialogOpen: (open: boolean) => void,
    handleSaveSlip: (data: any, id?: string) => void,
    isProcessing: boolean,
    processingItemId: string | null,
    slipToEdit: any,
    isRevenueDialogOpen: boolean,
    setIsRevenueDialogOpen: (open: boolean) => void,
    handleSaveRevenue: (data: any, isEdited: boolean) => void,
    revenueStatsToEdit: any,
    otherCostCategories: OtherCostCategory[],
    isIncidentDialogOpen: boolean,
    setIsIncidentDialogOpen: (open: boolean) => void,
    handleSaveIncident: (data: any, id?: string) => void,
    incidentToEdit: any,
    incidentCategories: IncidentCategory[],
    handleCategoriesChange: (newCategories: IncidentCategory[]) => void,
    canManageCategories: boolean,
    isCashHandoverDialogOpen: boolean,
    setIsCashHandoverDialogOpen: (open: boolean) => void,
    handleSaveCashHandover: (data: any, id?: string) => void,
    cashHandoverToEdit: CashHandoverReport | null,
    expectedCashForDialog: number,
    linkedRevenueForDialog: RevenueStats | null,
    linkedExpensesForDialog: ExpenseSlip[],
    isFinalHandoverViewOpen: boolean,
    setIsFinalHandoverViewOpen: (open: boolean) => void,
    handleUpdateFinalHandover: (data: any, id: string) => void,
    finalHandoverToView: (CashHandoverReport & { finalHandoverDetails: FinalHandoverDetails }) | null,
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
            {reporter && (
                <IncidentReportDialog
                    open={isIncidentDialogOpen}
                    onOpenChange={setIsIncidentDialogOpen}
                    onSave={handleSaveIncident}
                    isProcessing={isProcessing && (processingItemId === incidentToEdit?.id || processingItemId === 'new')}
                    categories={incidentCategories}
                    onCategoriesChange={handleCategoriesChange as any}
                    canManageCategories={canManageCategories}
                    reporter={incidentToEdit?.createdBy ? { userId: incidentToEdit?.createdBy.userId, userName: incidentToEdit?.createdBy.userName } : { userId: reporter.uid, userName: reporter.displayName }}
                    incidentToEdit={incidentToEdit as any}
                />
            )}
            <CashHandoverDialog
                open={isCashHandoverDialogOpen}
                onOpenChange={setIsCashHandoverDialogOpen}
                onSubmit={handleSaveCashHandover}
                isProcessing={isProcessing}
                expectedCash={expectedCashForDialog}
                countToEdit={cashHandoverToEdit}
                isOwnerView={true}
                linkedRevenueStats={linkedRevenueForDialog}
                linkedExpenseSlips={linkedExpensesForDialog}
                dateForNewEntry={dateForNewEntry}
            />
            <HandoverDialog
                open={isFinalHandoverViewOpen}
                onOpenChange={setIsFinalHandoverViewOpen}
                onSubmit={(data, id) => handleUpdateFinalHandover(data, id!)}
                id={finalHandoverToView?.id!}
                isProcessing={isProcessing}
                reportToEdit={finalHandoverToView?.finalHandoverDetails}
                isOwnerView={true}
            />
        </>
    );
});
OwnerCashierDialogs.displayName = 'OwnerCashierDialogs';

export default OwnerCashierDialogs;
