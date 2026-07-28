import { createContext, useContext, useState, ReactNode } from 'react';
import { useLocation } from 'wouter';
import { dirtyRegistry } from '@/lib/dirtyRegistry';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type NavigationGuardContextType = {
  safeNavigate: (path: string) => void;
};

const NavigationGuardContext = createContext<NavigationGuardContextType>({
  safeNavigate: () => {},
});

export function useNavigationGuard() {
  return useContext(NavigationGuardContext);
}

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const [, navigate] = useLocation();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  function safeNavigate(path: string) {
    if (dirtyRegistry.hasAny()) {
      setPendingPath(path);
    } else {
      navigate(path);
    }
  }

  function handleConfirm() {
    if (pendingPath) {
      dirtyRegistry.clear();
      navigate(pendingPath);
      setPendingPath(null);
    }
  }

  return (
    <NavigationGuardContext.Provider value={{ safeNavigate }}>
      {children}

      <AlertDialog open={pendingPath !== null} onOpenChange={(o) => { if (!o) setPendingPath(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in a client card. Leaving this page will discard them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingPath(null)}>Stay on Page</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Discard &amp; Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </NavigationGuardContext.Provider>
  );
}
