
import { useEffect } from "react";

/**
 * A utility component for debugging 
 * Only used in development environments
 */
export function DebugHelper() {
  useEffect(() => {
    // Log some useful debug information when component mounts
    console.log("Debug Helper loaded");
    console.log("Current route:", window.location.pathname);
    console.log("Environment:", process.env.NODE_ENV);
    
    // Check if running in development
    if (process.env.NODE_ENV === 'development') {
      console.log("Development mode enabled - showing additional debug info");
    }
    
    return () => {
      console.log("Debug Helper unmounted");
    };
  }, []);

  // Return null as this is just a debug utility
  return null;
}
