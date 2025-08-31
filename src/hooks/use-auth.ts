
'use client';
import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import { useToast } from './use-toast';

export type UserRole = 'staff' | 'manager';

export const useAuth = () => {
  const { toast } = useToast();
  const [role, setRole] = useState<UserRole | null>(null);
  const [staffName, setStaffName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPinDialog, setShowPinDialog] = useState(false);
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
        setShowPinDialog(true);
    } else {
        localStorage.setItem('userRole', newRole);
        setRole(newRole);
        router.push('/reports');
    }
  }, [router]);

  const confirmStaffPin = useCallback((pin: string) => {
    const staffList = dataStore.getStaff();
    const foundStaff = staffList.find(staff => staff.pin === pin);

    if (foundStaff) {
        localStorage.setItem('userRole', 'staff');
        localStorage.setItem('staffName', foundStaff.name);
        setRole('staff');
        setStaffName(foundStaff.name);
        setShowPinDialog(false);
        router.push('/shifts');
        toast({
          title: `Chào mừng, ${foundStaff.name}!`,
          description: "Ca làm việc của bạn đã sẵn sàng.",
        });
    } else {
        toast({
            variant: "destructive",
            title: "Mã PIN không hợp lệ",
            description: "Vui lòng thử lại.",
        })
    }
  }, [router, toast]);

  const logout = useCallback(() => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('staffName');
    setRole(null);
    setStaffName(null);
    setShowPinDialog(false);
    router.push('/');
  }, [router]);

  return { 
      role, 
      login, 
      logout, 
      isLoading, 
      staffName, 
      showPinDialog,
      setShowPinDialog,
      confirmStaffPin
  };
};
