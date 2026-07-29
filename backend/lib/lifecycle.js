'use strict';

const { createChildLogger } = require('./logger');

const lifecycleLogger = createChildLogger('lifecycle');

/**
 * Logs application startup information at "info" level.
 * Includes port number, Node.js version, and NODE_ENV.
 * @param {number|string} port - The port the server is listening on
 */
function logStartup(port) {
  lifecycleLogger.info({
    port,
    nodeVersion: process.version,
    nodeEnv: process.env.NODE_ENV || 'development',
  }, 'Application started');
}

/**
 * Logs missing environment variable names at "fatal" level and exits the process.
 * @param {string[]} vars - Array of missing environment variable names
 */
function logMissingEnvVars(vars) {
  lifecycleLogger.fatal({
    missingVars: vars,
  }, 'Missing required environment variables');
  process.exit(1);
}

/**
 * Registers SIGTERM and SIGINT handlers for graceful shutdown.
 * On signal: logs signal name at "info", flushes logger with 5-second timeout,
 * exits 0 on successful flush, exits 1 on timeout.
 * @param {import('pino').Logger} logger - The root pino logger instance to flush
 */
function setupGracefulShutdown(logger) {
  const handleSignal = (signal) => {
    lifecycleLogger.info({ signal }, `Received ${signal}, shutting down gracefully`);

    const timeout = setTimeout(() => {
      process.exit(1);
    }, 5000);

    // Prevent the timeout from keeping the process alive if flush completes
    if (timeout.unref) {
      timeout.unref();
    }

    logger.flush((err) => {
      clearTimeout(timeout);
      if (err) {
        process.exit(1);
      }
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => handleSignal('SIGTERM'));
  process.on('SIGINT', () => handleSignal('SIGINT'));
}

module.exports = {
  logStartup,
  logMissingEnvVars,
  setupGracefulShutdown,
};
