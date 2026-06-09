import React, { createContext, useState, useContext, useMemo } from 'react';

const UIContext = createContext();

export function UIProvider({ children }) {
  const [activeNav, setActiveNav] = useState('overview');
  const [selectedPONum, setSelectedPONum] = useState('');

  // App-level Statuses
  const [isLoading, setIsLoading] = useState(true);
  const [serverStatus, setServerStatus] = useState('loading'); // loading, ready, offline
  const [uploadStatus, setUploadStatus] = useState(null);
  const [importState, setImportState] = useState({ loading: false, lastMsg: '' });
  const [liveState, setLiveState] = useState({ active: false, lastSync: '', lastError: '' });

  const value = useMemo(
    () => ({
      activeNav,
      setActiveNav,
      selectedPONum,
      setSelectedPONum,
      isLoading,
      setIsLoading,
      serverStatus,
      setServerStatus,
      uploadStatus,
      setUploadStatus,
      importState,
      setImportState,
      liveState,
      setLiveState,
    }),
    [activeNav, selectedPONum, isLoading, serverStatus, uploadStatus, importState, liveState]
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  return useContext(UIContext);
}
