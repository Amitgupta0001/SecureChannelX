// FILE: src/hooks/useLocalStorage.js
import { useState, useEffect } from "react";

/**
 * Persist a state value in localStorage automatically.
 * Syncs across tabs and prevents JSON parsing errors.
 */
export default function useLocalStorage(key, defaultValue) {
  const readValue = () => {
    if (typeof window === "undefined") return defaultValue;

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (err) {
      console.warn(`useLocalStorage: Error reading key "${key}"`, err);
      return defaultValue;
    }
  };

  const [value, setValue] = useState(readValue);

  // Write to localStorage whenever value changes
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn(`useLocalStorage: Error setting key "${key}"`, err);
    }
  }, [key, value]);

  // Sync across browser tabs
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === key) {
        setValue(e.newValue ? JSON.parse(e.newValue) : defaultValue);
      }
    };
    window.addEventListener("storage", onStorage);

    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  return [value, setValue];
}
