import { describe, it, expect } from 'vitest';
const { classifyError, extractStatusCode } = require('./errorClassifier');

describe('errorClassifier', () => {
  describe('extractStatusCode', () => {
    it('returns statusCode when it is a valid integer between 100-599', () => {
      expect(extractStatusCode({ statusCode: 404 })).toBe(404);
      expect(extractStatusCode({ statusCode: 500 })).toBe(500);
      expect(extractStatusCode({ statusCode: 100 })).toBe(100);
      expect(extractStatusCode({ statusCode: 599 })).toBe(599);
    });

    it('falls back to status property when statusCode is not present', () => {
      expect(extractStatusCode({ status: 403 })).toBe(403);
    });

    it('prefers statusCode over status', () => {
      expect(extractStatusCode({ statusCode: 401, status: 500 })).toBe(401);
    });

    it('returns 500 for missing status codes', () => {
      expect(extractStatusCode({})).toBe(500);
      expect(extractStatusCode({ statusCode: undefined })).toBe(500);
    });

    it('returns 500 for non-integer values', () => {
      expect(extractStatusCode({ statusCode: 404.5 })).toBe(500);
      expect(extractStatusCode({ statusCode: '404' })).toBe(500);
      expect(extractStatusCode({ statusCode: null })).toBe(500);
    });

    it('returns 500 for out-of-range values', () => {
      expect(extractStatusCode({ statusCode: 99 })).toBe(500);
      expect(extractStatusCode({ statusCode: 600 })).toBe(500);
      expect(extractStatusCode({ statusCode: 0 })).toBe(500);
      expect(extractStatusCode({ statusCode: -1 })).toBe(500);
    });
  });

  describe('classifyError', () => {
    const mockReq = { path: '/api/test', url: '/api/test' };

    describe('authentication errors (401/403)', () => {
      it('classifies 401 as warn/authentication', () => {
        const err = { statusCode: 401, message: 'Unauthorized' };
        const result = classifyError(err, mockReq);
        expect(result.level).toBe('warn');
        expect(result.category).toBe('authentication');
        expect(result.details.statusCode).toBe(401);
        expect(result.details.path).toBe('/api/test');
      });

      it('classifies 403 as warn/authentication', () => {
        const err = { statusCode: 403, message: 'Forbidden' };
        const result = classifyError(err, mockReq);
        expect(result.level).toBe('warn');
        expect(result.category).toBe('authentication');
      });
    });

    describe('validation errors (4xx excluding 401/403)', () => {
      it('classifies 400 as warn/validation', () => {
        const err = { statusCode: 400, message: 'Bad Request' };
        const result = classifyError(err, mockReq);
        expect(result.level).toBe('warn');
        expect(result.category).toBe('validation');
      });

      it('classifies 404 as warn/validation', () => {
        const err = { statusCode: 404, message: 'Not Found' };
        const result = classifyError(err, mockReq);
        expect(result.level).toBe('warn');
        expect(result.category).toBe('validation');
      });

      it('classifies 422 as warn/validation', () => {
        const err = { statusCode: 422, message: 'Unprocessable Entity' };
        const result = classifyError(err, mockReq);
        expect(result.level).toBe('warn');
        expect(result.category).toBe('validation');
      });
    });

    describe('server errors (5xx)', () => {
      it('classifies 500 with database message as error/database', () => {
        const err = { statusCode: 500, message: 'relation "transactions" does not exist' };
        const result = classifyError(err, mockReq);
        expect(result.level).toBe('error');
        expect(result.category).toBe('database');
      });

      it('classifies 500 with PGRST code as error/database', () => {
        const err = { statusCode: 500, message: 'Some error', code: 'PGRST116' };
        const result = classifyError(err, mockReq);
        expect(result.level).toBe('error');
        expect(result.category).toBe('database');
      });

      it('classifies 500 without db indicators as error/service', () => {
        const err = { statusCode: 500, message: 'Something went wrong' };
        const result = classifyError(err, mockReq);
        expect(result.level).toBe('error');
        expect(result.category).toBe('service');
      });

      it('classifies 503 as error/service', () => {
        const err = { statusCode: 503, message: 'Service Unavailable' };
        const result = classifyError(err, mockReq);
        expect(result.level).toBe('error');
        expect(result.category).toBe('service');
      });
    });

    describe('unmatched errors', () => {
      it('classifies errors without valid status as error/unclassified (defaults to 500/service)', () => {
        // When no statusCode is present, extractStatusCode defaults to 500
        // which maps to 5xx → error/service or error/database
        const err = { message: 'Unknown error' };
        const result = classifyError(err, mockReq);
        expect(result.level).toBe('error');
        // No statusCode defaults to 500, which is 5xx → service
        expect(result.category).toBe('service');
      });

      it('classifies errors with status codes outside 400-599 as error/unclassified', () => {
        // Codes in 100-399 range hit the unclassified branch
        const err = { statusCode: 200, message: 'OK but errored' };
        const result = classifyError(err, mockReq);
        expect(result.level).toBe('error');
        expect(result.category).toBe('unclassified');
      });
    });

    describe('details object', () => {
      it('includes request path from req.path', () => {
        const err = { statusCode: 400, message: 'Bad' };
        const result = classifyError(err, { path: '/users/123' });
        expect(result.details.path).toBe('/users/123');
      });

      it('falls back to req.url when req.path is not available', () => {
        const err = { statusCode: 400, message: 'Bad' };
        const result = classifyError(err, { url: '/api/items' });
        expect(result.details.path).toBe('/api/items');
      });

      it('uses "unknown" when req is null', () => {
        const err = { statusCode: 400, message: 'Bad' };
        const result = classifyError(err, null);
        expect(result.details.path).toBe('unknown');
      });

      it('includes error message in details', () => {
        const err = { statusCode: 400, message: 'Invalid field' };
        const result = classifyError(err, mockReq);
        expect(result.details.message).toBe('Invalid field');
      });

      it('includes error code in details when present', () => {
        const err = { statusCode: 500, message: 'DB error', code: 'PGRST116' };
        const result = classifyError(err, mockReq);
        expect(result.details.code).toBe('PGRST116');
      });
    });

    describe('never throws', () => {
      it('handles undefined error gracefully', () => {
        const result = classifyError(undefined, mockReq);
        expect(result).toHaveProperty('level');
        expect(result).toHaveProperty('category');
        expect(result).toHaveProperty('details');
      });

      it('handles null error gracefully', () => {
        const result = classifyError(null, mockReq);
        expect(result).toHaveProperty('level');
        expect(result).toHaveProperty('category');
        expect(result).toHaveProperty('details');
      });

      it('handles error and req both being undefined', () => {
        const result = classifyError(undefined, undefined);
        expect(result).toHaveProperty('level');
        expect(result).toHaveProperty('category');
        expect(result).toHaveProperty('details');
      });
    });
  });
});
