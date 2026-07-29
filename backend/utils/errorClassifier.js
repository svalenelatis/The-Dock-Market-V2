/**
 * Error Classifier Utility
 *
 * Pure utility that classifies errors and returns appropriate log metadata.
 * This module never throws — it always returns a valid classification object.
 */

const DB_ERROR_PATTERNS = [
  /pgrst/i,
  /postgres/i,
  /supabase/i,
  /database/i,
  /relation/i,
  /constraint/i,
  /duplicate key/i,
  /sql/i,
];

/**
 * Extracts a valid HTTP status code from an error object.
 * Returns the statusCode/status if it's an integer between 100-599, otherwise 500.
 *
 * @param {Error|object} err
 * @returns {number}
 */
function extractStatusCode(err) {
  const code = err.statusCode !== undefined ? err.statusCode : err.status;

  if (
    typeof code === 'number' &&
    Number.isInteger(code) &&
    code >= 100 &&
    code <= 599
  ) {
    return code;
  }

  return 500;
}

/**
 * Determines whether a 5xx error is database-related or a general service error.
 *
 * @param {Error|object} err
 * @returns {string} "database" or "service"
 */
function classify5xxCategory(err) {
  const message = err.message || '';
  const code = err.code || '';

  for (const pattern of DB_ERROR_PATTERNS) {
    if (pattern.test(message) || pattern.test(code)) {
      return 'database';
    }
  }

  return 'service';
}

/**
 * Classifies an error and returns log metadata including level, category, and details.
 * This function never throws — it always returns a valid classification object.
 *
 * @param {Error|object} err - The error to classify
 * @param {object} req - The Express request object
 * @returns {{ level: string, category: string, details: object }}
 */
function classifyError(err, req) {
  try {
    const statusCode = extractStatusCode(err);
    const requestPath = (req && (req.path || req.url)) || 'unknown';

    let level;
    let category;

    if (statusCode === 401 || statusCode === 403) {
      level = 'warn';
      category = 'authentication';
    } else if (statusCode >= 400 && statusCode < 500) {
      level = 'warn';
      category = 'validation';
    } else if (statusCode >= 500 && statusCode <= 599) {
      level = 'error';
      category = classify5xxCategory(err);
    } else {
      level = 'error';
      category = 'unclassified';
    }

    const details = {
      statusCode,
      path: requestPath,
      message: err.message || String(err),
    };

    if (err.code) {
      details.code = err.code;
    }

    return { level, category, details };
  } catch (_e) {
    // The classifier must never throw — return a safe default
    return {
      level: 'error',
      category: 'unclassified',
      details: {
        statusCode: 500,
        path: 'unknown',
        message: 'Classification failed',
      },
    };
  }
}

module.exports = {
  classifyError,
  extractStatusCode,
};
