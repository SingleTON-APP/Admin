import { createContext, useContext } from 'react';
import type { StaffIdentity } from '../../types/domain';

export const AdminContext = createContext<StaffIdentity | null>(null);

export function useAdmin() {
  const value = useContext(AdminContext);
  if (!value) throw new Error('Admin context is unavailable');
  return value;
}
