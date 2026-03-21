import React from 'react';

export interface PageShellConfig {
  title?: string;
  subtitle?: string;
}

interface PageShellContextValue {
  config: PageShellConfig;
  actions: React.ReactNode;
  setConfig: React.Dispatch<React.SetStateAction<PageShellConfig>>;
  setActions: (actions: React.ReactNode) => void;
}

const PageShellContext = React.createContext<PageShellContextValue | null>(null);

export function PageShellProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = React.useState<PageShellConfig>({});
  const actionsRef = React.useRef<React.ReactNode>(null);

  const setActions = React.useCallback((actions: React.ReactNode) => {
    actionsRef.current = actions;
  }, []);

  const value = React.useMemo(
    () => ({
      config,
      actions: actionsRef.current,
      setConfig,
      setActions,
    }),
    [config, setActions]
  );

  return <PageShellContext.Provider value={value}>{children}</PageShellContext.Provider>;
}

export function usePageShellContext() {
  return React.useContext(PageShellContext);
}
