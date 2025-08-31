
'use client';
import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export type UserRole = 'staff' | 'manager';

// This is a mock auth hook that uses localStorage.
// In a real app, you would replace this with a proper authentication solution.
export const useAuth = () => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [staffName, setStaffName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showStaffNameDialog, setShowStaffNameDialog] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    try {
      const storedRole = localStorage.getItem('userRole') as UserRole | null;
      const storedStaffName = localStorage.getItem('staffName');
      if (storedRole) {
        setRole(storedRole);
        if (storedRole === 'staff' && storedStaffName) {
            setStaffName(storedStaffName);
        }
      } else if (pathname !== '/') {
        // Don't redirect if we are already on the login page
      }
    } catch (error) {
      console.error("Could not access localStorage", error);
    } finally {
      setIsLoading(false);
    }
  }, [pathname, router]);

  const login = useCallback((newRole: UserRole) => {
    if (newRole === 'staff') {
        setShowStaffNameDialog(true);
    } else {
        localStorage.setItem('userRole', newRole);
        setRole(newRole);
        router.push('/reports');
    }
  }, [router]);

  const confirmStaffLogin = useCallback((name: string) => {
    if (name) {
        localStorage.setItem('userRole', 'staff');
        localStorage.setItem('staffName', name);
        setRole('staff');
        setStaffName(name);
        setShowStaffNameDialog(false);
        router.push('/shifts');
    }
  }, [router]);

  const logout = useCallback(() => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('staffName');
    setRole(null);
    setStaffName(null);
    setShowStaffNameDialog(false);
    router.push('/');
  }, [router]);

  return { 
      role, 
      login, 
      logout, 
      isLoading, 
      staffName, 
      showStaffNameDialog, 
      setShowStaffNameDialog,
      confirmStaffLogin
  };
};
