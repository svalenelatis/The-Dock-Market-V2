'use strict';

const { createChildLogger } = require('../lib/logger');
const { classifyError, extractStatusCode } = require('../utils/errorClassifier');

const errorHandlerLogger = createChildLogger('errorHandler');

/**
 * Centralized Express error-handling middleware.
 * Uses the 4-argument signature (err, req, res, next) to catch all unhandled errors.
 */
function errorHandler(err, req, res, next) {
  const statusCode = extractStatusCode(err);
  const { level, category } = classifyError(err, req);

  // Determine which logger to use — req.log has correlationId context
  const log = req && req.log ? req.log : errorHandlerLogger;

  // Get correlationId from the response header (set by requestLogger middleware)
  const correlationId = (res && res.getHeader && res.getHeader('x-correlation-id')) || 'unknown';

  const errorMessage = err.message || String(err);
  const errorStack = err.stack || undefined;

  // Log the error at the classified level with required fields
  const logPayload = {
    err: {
      message: errorMessage,
      stack: errorStack,
    },
    correlationId,
    category,
    statusCode,
  };

  if (typeof log[level] === 'function') {
    log[level](logPayload, errorMessage);
  } else {
    log.error(logPayload, errorMessage);
  }

  // If headers already sent, delegate to Express default error handler
  if (res.headersSent) {
    return next(err);
  }

  // Build response body
  const isDevelopment = process.env.NODE_ENV === 'development';
  let responseBody;

  if (isDevelopment) {
    responseBody = {
      error: errorMessage,
      stack: errorStack || null,
      correlationId,
    };
  } else {
    // Production: generic message for 5xx, actual message for client errors
    const errorField = statusCode >= 500 ? 'Internal server error' : errorMessage;
    responseBody = {
      error: errorField,
      correlationId,
    };
  }

  // Send response — wrapped in try/catch for robustness
  try {
    res.status(statusCode).json(responseBody);
  } catch (_serializationError) {
    // Hardcoded fallback if response serialization fails
    try {
      res.status(statusCode).set('Content-Type', 'application/json').end(
        JSON.stringify({ error: 'Internal server error', correlationId: correlationId || 'unknown' })
      );
    } catch (_fallbackError) {
      // Nothing more we can do — delegate to Express
      next(err);
    }
  }
}

module.exports = errorHandler;
