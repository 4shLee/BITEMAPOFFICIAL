import { createContext, useContext, type ReactNode } from 'react';

export type QuickAlert = {
  id: string;
  title: string;
  detail: string;
  tone: 'warning' | 'danger' | 'info';
  count: number;
};

export type HeaderAlertsState = {
  quickAlerts: QuickAlert[];
  clinicPriorityCount: number;
  clinicSmsSimulation: boolean;
  alertsLoading: boolean;
};

const HeaderAlertsContext = createContext<HeaderAlertsState | null>(null);

export function HeaderAlertsProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: HeaderAlertsState;
}) {
  return (
    <HeaderAlertsContext.Provider value={value}>
      {children}
    </HeaderAlertsContext.Provider>
  );
}

export function useHeaderAlerts(): HeaderAlertsState {
  const context = useContext(HeaderAlertsContext);

  if (!context) {
    throw new Error('useHeaderAlerts must be used within MainLayout.');
  }

  return context;
}
