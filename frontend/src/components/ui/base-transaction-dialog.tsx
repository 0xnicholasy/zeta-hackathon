import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from './dialog';
import { Button } from './button';
import { TokenNetworkIcon } from './token-network-icon';
import { Spinner } from './spinner';

interface BaseTransactionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: React.ReactNode;
    description: string;
    tokenSymbol?: string;
    sourceChain?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    currentStep?: string;
    isSubmitting?: boolean;
    onSubmit?: () => void;
    onApprove?: () => void;
    isValidAmount?: boolean;
    isConnected?: boolean;
    submitButtonText?: string;
    approveButtonText?: string;
    canApprove?: boolean;
}

export function BaseTransactionDialog({
    isOpen,
    onClose,
    title,
    description,
    tokenSymbol,
    sourceChain,
    children,
    footer,
    currentStep = 'input',
    isSubmitting = false,
    onSubmit,
    onApprove,
    isValidAmount = false,
    isConnected = false,
    submitButtonText = 'Submit',
    approveButtonText = 'Approve',
    canApprove = false,
}: BaseTransactionDialogProps) {
    const renderFooter = () => {
        if (footer) {
            return footer;
        }

        if (currentStep === 'input') {
            return (
                <>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="zeta"
                        onClick={onSubmit}
                        disabled={!isValidAmount || isSubmitting || !isConnected}
                    >
                        {isSubmitting && <Spinner variant="white" size="xs" className="mr-2" />}
                        {isSubmitting ? 'Processing...' : submitButtonText}
                    </Button>
                </>
            );
        }

        if (currentStep === 'approve') {
            return (
                <>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="zeta"
                        onClick={onApprove}
                        disabled={!canApprove}
                    >
                        {approveButtonText}
                    </Button>
                </>
            );
        }

        return (
            <Button variant="outline" onClick={onClose} className="w-full">
                Close
            </Button>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md max-w-[95vw] overflow-hidden">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {tokenSymbol && sourceChain && (
                            <TokenNetworkIcon
                                tokenSymbol={tokenSymbol}
                                sourceChain={sourceChain}
                                size="sm"
                                shadow="sm"
                                showNativeIndicator={true}
                            />
                        )}
                        {title}
                    </DialogTitle>
                    <DialogDescription>
                        {description}
                    </DialogDescription>
                </DialogHeader>

                {children}

                <DialogFooter>
                    {renderFooter()}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}