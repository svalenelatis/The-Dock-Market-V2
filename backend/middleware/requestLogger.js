'use strict';

const { v4: uuidv4 } = require('uuid');
const { createChildLogger } = require('../lib/logger');

const requestLoggerChild = createChildLogger('requestLogger');

/**
 * Express middleware that assigns a correlation ID to each request,
 * attaches a child logger to req.log, and logs request/response lifecycle.
 */
function requestLogger(req, res, next) {
  try {
    let correlationId;
    try {
      correlationId = uuidv4();
    } catch (e) {
      correlationId = 'unknown-' + Date.now();
    }

    res.setHeader('x-correlation-id', correlationId);

    const childLogger = requestLoggerChild.child({ correlationId });
    req.log = childLogger;

    const startTime = Date.now();

    childLogger.info({ method: req.method, url: req.url }, 'Request started');

    res.on('finish', () => {
      try {
        const responseTimeMs = Date.now() - startTime;
        const logData = {
          statusCode: res.statusCode,
          responseTimeMs,
        };

        if (res.statusCode >= 400) {
          childLogger.warn(logData, 'Request completed');
        } else {
          childLogger.info(logData, 'Request completed');
        }
      } catch (e) {
        // Logging failure must not interrupt processing
      }
    });
  } catch (e) {
    // Logging failure must not interrupt request processing
  }

  next();
}

module.exports = requestLogger;
