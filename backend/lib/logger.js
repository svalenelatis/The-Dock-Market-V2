'use strict';

const pino = require('pino');

const ALLOWED_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];

const redactPaths = [
  'req.headers.authorization',
  'req.headers["x-api-key"]',
  '*.password',
  '*.secret',
  '*.token',
  '*.apiKey',
  '*.apikey',
];

/**
 * Validates the LOG_LEVEL environment variable against allowed pino levels.
 * Returns the validated level or "info" as default.
 */
function resolveLogLevel() {
  const envLevel = process.env.LOG_LEVEL;
  if (envLevel && ALLOWED_LEVELS.includes(envLevel.toLowerCase())) {
    return envLevel.toLowerCase();
  }
  return 'info';
}

const nodeEnv = process.env.NODE_ENV;

const loggerOptions = {
  level: resolveLogLevel(),
  base: { service: 'dock-market-backend' },
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  redact: {
    paths: redactPaths,
    censor: '[REDACTED]',
  },
  serializers: {
    err: pino.stdSerializers.err,
  },
};

// Use pino-pretty unless explicitly in production
if (nodeEnv !== 'production') {
  loggerOptions.transport = {
    target: 'pino-pretty',
    options: { colorize: true },
  };
}

const logger = pino(loggerOptions);

/**
 * Creates a child logger scoped to a specific module.
 * @param {string} module - The module name (must be a non-empty string)
 * @returns {import('pino').Logger} A child logger with the module binding
 * @throws {Error} If module is not a non-empty string
 */
function createChildLogger(module) {
  if (typeof module !== 'string' || module.length === 0) {
    throw new Error('A valid module name is required (non-empty string)');
  }
  return logger.child({ module });
}

module.exports = {
  logger,
  createChildLogger,
};
