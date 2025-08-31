'use client';
import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export type UserRole = 'staff' | 'manager';

// This is a mock auth hook that uses localStorage.
// In a real app, you would replace this with a proper authentication solution.
export const useAuth = () => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    try {
      const storedRole = localStorage.getItem('userRole') as UserRole | null;
      if (storedRole) {
        setRole(storedRole);
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
    localStorage.setItem('userRole', newRole);
    setRole(newRole);
    if (newRole === 'staff') {
      router.push('/checklist');
    } else {
      router.push('/reports');
    }
  }, [router]);

  const logout = useCallback(() => {
    localStorage.removeItem('userRole');
    setRole(null);
    router.push('/');
  }, [router]);

  return { role, login, logout, isLoading };
};
