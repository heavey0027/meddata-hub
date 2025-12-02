
import { SystemLog } from '../types';

const STORAGE_KEY = 'meddata_system_logs';

export const getLogs = (): SystemLog[] => {
  try {
    const logs = localStorage.getItem(STORAGE_KEY);
    return logs ? JSON.parse(logs) : [];
  } catch (e) {
    return [];
  }
};

export const addLog = (
  level: SystemLog['level'], 
  module: string, 
  action: string, 
  details?: string,
  metadata?: any
) => {
  // Safe Metadata Handling: Prevent huge objects from filling LocalStorage
  let safeMetadata = metadata;
  if (metadata) {
    try {
      const str = JSON.stringify(metadata);
      // If larger than ~10KB, truncate it
      if (str.length > 10000) {
         safeMetadata = { 
           _warning: 'Metadata truncated due to size limit',
           preview: str.substring(0, 1000) + '... [TRUNCATED]',
           originalType: typeof metadata
         };
      }
    } catch (e) {
      safeMetadata = { error: 'Circular or invalid JSON structure' };
    }
  }

  const newLog: SystemLog = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toLocaleString(),
    level,
    module,
    action,
    details,
    metadata: safeMetadata
  };
  
  const logs = getLogs();
  // Keep last 200 logs to ensure performance and storage space
  const updatedLogs = [newLog, ...logs].slice(0, 200);
  
  try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLogs));
  } catch (e) {
      // If quota exceeded, drastically reduce log count
      console.warn("LocalStorage quota exceeded, clearing old logs.");
      const halvedLogs = [newLog, ...logs].slice(0, 50);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(halvedLogs));
  }
};

export const clearLogs = () => {
  localStorage.removeItem(STORAGE_KEY);
};
