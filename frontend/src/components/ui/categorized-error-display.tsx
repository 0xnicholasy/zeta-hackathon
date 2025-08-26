import { useEffect } from 'react';
import { Button } from './button';
import { categorizeError, getSeverityClasses, getSeverityIcon } from '@/utils/errorCategorization';

interface CategorizedErrorDisplayProps {
    error: Error | string;
    onRetry?: () => void;
    onDismiss?: () => void;
    className?: string;
    showTechnicalDetails?: boolean;
}

/**
 * Displays errors with proper categorization and user-friendly messaging
 */
export function CategorizedErrorDisplay({
    error,
    onRetry,
    onDismiss,
    className = '',
    showTechnicalDetails = false
}: CategorizedErrorDisplayProps) {
    const categorizedError = categorizeError(error);
    const severityClasses = getSeverityClasses(categorizedError.severity);
    const severityIcon = getSeverityIcon(categorizedError.severity);

    return (
        <div className={`p-4 border rounded-lg ${severityClasses.borderClass} ${severityClasses.bgClass} ${className}`}>
            {/* Error Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-lg">{severityIcon}</span>
                    <div>
                        <div className={`font-medium ${severityClasses.textClass}`}>
                            {categorizedError.title}
                        </div>
                        <div className={`text-sm mt-1 ${severityClasses.textClass}`}>
                            {categorizedError.message}
                        </div>
                    </div>
                </div>
                {onDismiss && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onDismiss}
                        className="h-6 w-6 p-0"
                    >
                        ✕
                    </Button>
                )}
            </div>

            {/* User Action Guidance */}
            {categorizedError.userAction && (
                <div className={`text-sm mt-3 p-2 rounded ${severityClasses.bgClass} border ${severityClasses.borderClass}`}>
                    <strong className={severityClasses.textClass}>What to do: </strong>
                    <span className={severityClasses.textClass}>
                        {categorizedError.userAction}
                    </span>
                </div>
            )}

            {/* Technical Details (Collapsible) */}
            {showTechnicalDetails && categorizedError.technicalDetails && (
                <details className="mt-3">
                    <summary className={`cursor-pointer text-xs ${severityClasses.textClass} hover:opacity-80`}>
                        Technical Details
                    </summary>
                    <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono overflow-auto max-h-32">
                        <pre className="whitespace-pre-wrap break-all">
                            {categorizedError.technicalDetails}
                        </pre>
                    </div>
                </details>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 mt-4">
                {categorizedError.canRetry && onRetry && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onRetry}
                        className="text-xs"
                    >
                        Try Again
                    </Button>
                )}
                {onDismiss && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onDismiss}
                        className="text-xs"
                    >
                        Dismiss
                    </Button>
                )}
            </div>
        </div>
    );
}

interface ErrorSummaryProps {
    error: Error | string;
    className?: string;
}

/**
 * Compact error summary for inline display
 */
export function ErrorSummary({ error, className = '' }: ErrorSummaryProps) {
    const categorizedError = categorizeError(error);
    const severityClasses = getSeverityClasses(categorizedError.severity);
    const severityIcon = getSeverityIcon(categorizedError.severity);

    return (
        <div className={`flex items-center gap-2 text-sm p-2 rounded ${severityClasses.bgClass} ${severityClasses.borderClass} border ${className}`}>
            <span className="text-xs">{severityIcon}</span>
            <div className={severityClasses.textClass}>
                <span className="font-medium">{categorizedError.title}: </span>
                <span>{categorizedError.message}</span>
            </div>
        </div>
    );
}

interface ErrorToastProps {
    error: Error | string;
    onClose: () => void;
    autoClose?: boolean;
    autoCloseDelay?: number;
}

/**
 * Toast-style error notification
 */
export function ErrorToast({
    error,
    onClose,
    autoClose = true,
    autoCloseDelay = 5000
}: ErrorToastProps) {
    const categorizedError = categorizeError(error);
    const severityClasses = getSeverityClasses(categorizedError.severity);
    const severityIcon = getSeverityIcon(categorizedError.severity);

    useEffect(() => {
        if (autoClose && categorizedError.severity !== 'critical') {
            const timer = setTimeout(onClose, autoCloseDelay);
            return () => clearTimeout(timer);
        }
        return () => { }
    }, [autoClose, autoCloseDelay, categorizedError.severity, onClose]);

    return (
        <div className={`fixed top-4 right-4 max-w-md p-4 border rounded-lg shadow-lg ${severityClasses.borderClass} ${severityClasses.bgClass} z-50`}>
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-lg">{severityIcon}</span>
                    <div>
                        <div className={`font-medium ${severityClasses.textClass}`}>
                            {categorizedError.title}
                        </div>
                        <div className={`text-sm mt-1 ${severityClasses.textClass}`}>
                            {categorizedError.message}
                        </div>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="h-6 w-6 p-0"
                >
                    ✕
                </Button>
            </div>

            {categorizedError.userAction && (
                <div className={`text-xs mt-2 ${severityClasses.textClass}`}>
                    {categorizedError.userAction}
                </div>
            )}
        </div>
    );
}