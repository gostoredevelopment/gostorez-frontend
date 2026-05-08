// Create a new file: contexts/NotificationContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import InAppNotification from '../components/InAppNotification';

const NotificationContext = createContext({});

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  return (
    <NotificationContext.Provider value={{}}>
      <InAppNotification />
      {children}
    </NotificationContext.Provider>
  );
};