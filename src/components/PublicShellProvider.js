'use client';

import { createContext, useContext } from 'react';

const PublicShellContext = createContext(null);

export function PublicShellProvider({ shell, children }) {
  return <PublicShellContext.Provider value={shell}>{children}</PublicShellContext.Provider>;
}

export function usePublicShell() {
  const shell = useContext(PublicShellContext);
  if (!shell) throw new Error('Published Site Shell context is missing.');
  return shell;
}
