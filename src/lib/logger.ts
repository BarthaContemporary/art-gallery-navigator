
const isDevelopment = process.env.NODE_ENV === 'development';

interface Logger {
  log: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  info: (...args: any[]) => void;
  debug: (...args: any[]) => void; // Added for more granular debug logs
}

const noOp = () => {}; // No operation function

export const logger: Logger = {
  log: isDevelopment ? console.log.bind(console) : noOp,
  warn: isDevelopment ? console.warn.bind(console) : noOp,
  error: isDevelopment ? console.error.bind(console) : noOp,
  info: isDevelopment ? console.info.bind(console) : noOp,
  debug: isDevelopment ? console.debug.bind(console) : noOp,
};

// Optionally, you can expose a method to force logging for specific critical production issues,
// but this should be used very sparingly.
// export const forceLog = console.log.bind(console);

