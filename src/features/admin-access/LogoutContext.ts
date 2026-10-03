import { createContext, useContext } from 'react';
export const LogoutContext = createContext<
  (serverRevoked?: boolean) => Promise<void>
>(async () => {});
export function useAdminLogout() {
  return useContext(LogoutContext);
}
