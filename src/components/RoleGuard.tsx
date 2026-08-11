import type { ReactNode } from 'react';
import { useAuth, type AppRole } from '@/contexts/AuthContext';

interface RoleGuardProps {
  roles: AppRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RoleGuard({ roles, children, fallback = null }: RoleGuardProps) {
  const { role } = useAuth();
  if (!roles.includes(role)) return <>{fallback}</>;
  return <>{children}</>;
}
