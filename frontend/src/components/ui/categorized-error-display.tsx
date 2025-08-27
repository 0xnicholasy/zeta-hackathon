import { useEffect, useState } from 'react';
import { Button } from './button';
import { categorizeError, getSeverityClasses, getSeverityIcon, type CategorizedError } from '@/utils/errorCategorization';

interface CategorizedErrorDisplayProps {
    error: CategorizedError;
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
    const [showTechnical, setShowTechnical] = useState(false);
    const severityClasses = getSeverityClasses(error.severity);
    const severityIcon = getSeverityIcon(error.severity);

    return (
        <div className={`p-4 border rounded-lg ${severityClasses.combined} ${className}`}>
            {/* Error Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-lg" aria-hidden="true">{severityIcon}</span>
                    <div>
                        <div className="font-medium">
                            {error.title}
                        </div>
                        <div className="text-sm mt-1">
                            {error.message}
                        </div>
                    </div>
                </div>
                {onDismiss && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onDismiss}
                        className="h-6 w-6 p-0"
                        aria-label="Dismiss error"
                    >
                        ✕
                    </Button>
                )}
            </div>

            {/* User Action Guidance */}
            {error.userAction && (
                <div className="text-sm mt-3 p-2 rounded border">
                    <strong>What to do: </strong>
                    <span>
                        {error.userAction}
                    </span>
                </div>
            )}

            {/* Technical Details (Collapsible) */}
            {showTechnicalDetails && error.technicalDetails && (
                <div className="mt-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowTechnical(!showTechnical)}
                        className="text-xs p-0 h-auto underline"
                    >
                        {showTechnical ? 'Hide Technical Details' : 'Show Technical Details'}
                    </Button>
                    {showTechnical && (
                        <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono overflow-auto max-h-32">
                            <pre className="whitespace-pre-wrap break-all">
                                {error.technicalDetails}
                            </pre>
                        </div>
                    )}
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 mt-4">
                {error.canRetry && onRetry && (
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
            <span className="text-xs" aria-hidden="true">{severityIcon}</span>
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
        if (autoClose && categorizedError.severity !== 'error') {
            const timer = setTimeout(onClose, autoCloseDelay);
            return () => clearTimeout(timer);
        }
        return () => { }
    }, [autoClose, autoCloseDelay, categorizedError.severity, onClose]);

    return (
        <div
            className={`fixed top-4 right-4 max-w-md p-4 border rounded-lg shadow-lg ${severityClasses.borderClass} ${severityClasses.bgClass} z-50`}
            role={categorizedError.severity === 'error' ? 'alert' : 'status'}
            aria-live={categorizedError.severity === 'error' ? 'assertive' : 'polite'}
        >
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-lg" aria-hidden="true">{severityIcon}</span>
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
                    aria-label="Close notification"
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