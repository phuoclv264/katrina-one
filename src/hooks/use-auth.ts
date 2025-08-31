
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
        router.replace('/');
      }
    } catch (error) {
      console.error("Could not access localStorage", error);
       if (pathname !== '/') {
        router.replace('/');
      }
    } finally {
      setIsLoading(false);
    }
  }, [pathname, router]);

  const login = useCallback((newRole: UserRole) => {
    let name = '';
    if (newRole === 'staff') {
        // In a real app, you'd get this from a login form
        name = `Nhân viên ${Math.floor(Math.random() * 100) + 1}`;
        localStorage.setItem('staffName', name);
        setStaffName(name);
    }
    localStorage.setItem('userRole', newRole);
    setRole(newRole);

    if (newRole === 'staff') {
      router.push('/shifts');
    } else {
      router.push('/reports');
    }
  }, [router]);

  const logout = useCallback(() => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('staffName');
    setRole(null);
    setStaffName(null);
    router.push('/');
  }, [router]);

  return { role, login, logout, isLoading, staffName };
};
