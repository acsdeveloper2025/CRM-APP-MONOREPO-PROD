import { useEffect, useState } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from '@/ui/components/alert-dialog';
import { Button } from '@/ui/components/button';
import { sessionManager } from '@/services/sessionManager';
interface SessionTimeoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    remainingSeconds: number;
}
export function SessionTimeoutModal({ isOpen, onClose, remainingSeconds }: SessionTimeoutModalProps) {
    const [seconds, setSeconds] = useState(remainingSeconds);
    useEffect(() => {
        setSeconds(remainingSeconds);
    }, [remainingSeconds]);
    const handleStayLoggedIn = async () => {
        await sessionManager.extendSession();
        onClose();
    };
    const handleLogout = () => {
        sessionManager.logout();
        onClose();
    };
    // Prevent closing by clicking outside or pressing escape
    const handleOpenChange = (open: boolean) => {
        if (!open) {
            // Only allow closing via buttons
        }
    };
    if (!isOpen) {
        return null;
    }
    return (<AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Session Timeout Warning</AlertDialogTitle>
          <AlertDialogDescription>
            You have been inactive for a while. For your security, you will be automatically logged out in{' '}
            <span {...{ className: "font-bold text-red-500" }}>{seconds} seconds</span>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={handleLogout}>
            Logout Now
          </Button>
          <Button onClick={handleStayLoggedIn}>
            Stay Logged In
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>);
}
