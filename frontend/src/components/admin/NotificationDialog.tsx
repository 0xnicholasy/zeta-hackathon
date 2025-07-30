import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';

export interface NotificationState {
  isOpen: boolean;
  type: 'success' | 'error' | 'pending';
  title: string;
  message: string;
  txHash?: `0x${string}`;
}

interface NotificationDialogProps {
  notification: NotificationState;
  onClose: () => void;
}

export function NotificationDialog({ notification, onClose }: NotificationDialogProps) {
  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-6 w-6 text-red-500" />;
      case 'pending':
        return <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />;
      default:
        return null;
    }
  };

  return (
    <Dialog
      open={notification.isOpen}
      onOpenChange={(open) => {
        if (!open && notification.type !== 'pending') {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {getIcon()}
            {notification.title}
          </DialogTitle>
          <DialogDescription className="text-left">
            {notification.message}
          </DialogDescription>
          {notification.txHash && (
            <div className="text-xs text-muted-foreground mt-2">
              Transaction Hash: {notification.txHash}
            </div>
          )}
        </DialogHeader>
        <DialogFooter>
          {notification.type !== 'pending' && (
            <Button onClick={onClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}