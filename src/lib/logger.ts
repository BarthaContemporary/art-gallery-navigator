
const isProduction = process.env.NODE_ENV === 'production';

interface Logger {
  log: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  info: (...args: any[]) => void;
  debug: (...args: any[]) => void;
}

const noOp = () => {}; // No operation function

// Only log in development, completely silent in production
export const logger: Logger = {
  log: isProduction ? noOp : console.log.bind(console),
  warn: isProduction ? noOp : console.warn.bind(console),
  error: isProduction ? noOp : console.error.bind(console),
  info: isProduction ? noOp : console.info.bind(console),
  debug: isProduction ? noOp : console.debug.bind(console),
};

// Optionally, you can expose a method to force logging for specific critical production issues,
// but this should be used very sparingly.
// export const forceLog = console.log.bind(console);

