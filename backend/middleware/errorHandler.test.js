import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the logger module before requiring the error handler
vi.mock('../lib/logger', () => {
  const mockChildLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(() => mockChildLogger),
  };
  return {
    logger: mockChildLogger,
    createChildLogger: vi.fn(() => mockChildLogger),
  };
});

const errorHandler = require('./errorHandler');

function createMockReq(overrides = {}) {
  const mockLog = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  };
  return {
    log: mockLog,
    path: '/api/test',
    url: '/api/test',
    method: 'GET',
    ...overrides,
  };
}

function createMockRes(overrides = {}) {
  const headers = { 'x-correlation-id': 'test-correlation-id-1234' };
  const res = {
    headersSent: false,
    statusCode: 200,
    getHeader: vi.fn((name) => headers[name]),
    setHeader: vi.fn((name, value) => { headers[name] = value; }),
    status: vi.fn(function (code) {
      this.statusCode = code;
      return this;
    }),
    json: vi.fn(function (body) {
      this._body = body;
      return this;
    }),
    set: vi.fn(function () { return this; }),
    end: vi.fn(function () { return this; }),
    ...overrides,
  };
  return res;
}

describe('errorHandler middleware', () => {
  let originalNodeEnv;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.clearAllMocks();
  });

  describe('status code extraction (Req 4.5, 4.6)', () => {
    it('uses err.statusCode as HTTP response status', () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = vi.fn();
      const err = new Error('Not Found');
      err.statusCode = 404;

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('uses err.status as HTTP response status when statusCode is absent', () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = vi.fn();
      const err = new Error('Forbidden');
      err.status = 403;

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('defaults to 500 when no valid status code is present', () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = vi.fn();
      const err = new Error('Something broke');

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('defaults to 500 for out-of-range status codes', () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = vi.fn();
      const err = new Error('Bad code');
      err.statusCode = 999;

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('logging (Req 4.1)', () => {
    it('logs error message and correlationId using req.log', () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = vi.fn();
      const err = new Error('Database connection failed');
      err.statusCode = 500;

      errorHandler(err, req, res, next);

      expect(req.log.error).toHaveBeenCalled();
      const logCall = req.log.error.mock.calls[0];
      expect(logCall[0].correlationId).toBe('test-correlation-id-1234');
      expect(logCall[0].err.message).toBe('Database connection failed');
      expect(logCall[0].err.stack).toBeDefined();
    });

    it('logs at the classified level (warn for 4xx)', () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = vi.fn();
      const err = new Error('Bad request');
      err.statusCode = 400;

      errorHandler(err, req, res, next);

      expect(req.log.warn).toHaveBeenCalled();
      const logCall = req.log.warn.mock.calls[0];
      expect(logCall[0].category).toBe('validation');
    });

    it('includes stack trace in log payload', () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = vi.fn();
      const err = new Error('Stack test');

      errorHandler(err, req, res, next);

      const logCall = req.log.error.mock.calls[0];
      expect(logCall[0].err.stack).toContain('Stack test');
    });
  });

  describe('response body (Req 4.2)', () => {
    it('always includes correlationId in response JSON', () => {
      process.env.NODE_ENV = 'production';
      const req = createMockReq();
      const res = createMockRes();
      const next = vi.fn();
      const err = new Error('Oops');

      errorHandler(err, req, res, next);

      expect(res.json).toHaveBeenCalled();
      const body = res.json.mock.calls[0][0];
      expect(body.correlationId).toBe('test-correlation-id-1234');
    });

    it('always includes error field as a string', () => {
      process.env.NODE_ENV = 'production';
      const req = createMockReq();
      const res = createMockRes();
      const next = vi.fn();
      const err = new Error('Test error');
      err.statusCode = 400;

      errorHandler(err, req, res, next);

      const body = res.json.mock.calls[0][0];
      expect(typeof body.error).toBe('string');
    });
  });

  describe('production mode (Req 4.3)', () => {
    it('responds with generic "Internal server error" for 5xx', () => {
      process.env.NODE_ENV = 'production';
      const req = createMockReq();
      const res = createMockRes();
      const next = vi.fn();
      const err = new Error('Secret database details');
      err.statusCode = 500;

      errorHandler(err, req, res, next);

      const body = res.json.mock.calls[0][0];
      expect(body.error).toBe('Internal server error');
      expect(body.stack).toBeUndefined();
    });

    it('shows actual error message for 4xx in production', () => {
      process.env.NODE_ENV = 'production';
      const req = createMockReq();
      const res = createMockRes();
      const next = vi.fn();
      const err = new Error('Validation failed: name is required');
      err.statusCode = 422;

      errorHandler(err, req, res, next);

      const body = res.json.mock.calls[0][0];
      expect(body.error).toBe('Validation failed: name is required');
      expect(body.stack).toBeUndefined();
    });
  });

  describe('development mode (Req 4.4)', () => {
    it('includes error message and stack in response body', () => {
      process.env.NODE_ENV = 'development';
      const req = createMockReq();
      const res = createMockRes();
      const next = vi.fn();
      const err = new Error('Dev debug error');
      err.statusCode = 500;

      errorHandler(err, req, res, next);

      const body = res.json.mock.calls[0][0];
      expect(body.error).toBe('Dev debug error');
      expect(body.stack).toContain('Dev debug error');
      expect(body.correlationId).toBe('test-correlation-id-1234');
    });
  });

  describe('headers already sent (Req 4.7)', () => {
    it('logs error and delegates to next(err) when headers sent', () => {
      const req = createMockReq();
      const res = createMockRes({ headersSent: true });
      const next = vi.fn();
      const err = new Error('Late error');

      errorHandler(err, req, res, next);

      // Should log the error
      expect(req.log.error).toHaveBeenCalled();
      // Should delegate to next
      expect(next).toHaveBeenCalledWith(err);
      // Should NOT try to send a response
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('robustness', () => {
    it('handles error without message property', () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = vi.fn();
      const err = { statusCode: 500 };

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalled();
    });

    it('uses fallback logger when req.log is not available', () => {
      const req = createMockReq({ log: undefined });
      const res = createMockRes();
      const next = vi.fn();
      const err = new Error('No req.log');

      // Should not throw
      expect(() => errorHandler(err, req, res, next)).not.toThrow();
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('uses "unknown" correlationId when header is not set', () => {
      const req = createMockReq();
      const res = createMockRes();
      res.getHeader = vi.fn(() => undefined);
      const next = vi.fn();
      const err = new Error('No correlation');

      errorHandler(err, req, res, next);

      const body = res.json.mock.calls[0][0];
      expect(body.correlationId).toBe('unknown');
    });

    it('sends hardcoded fallback if json serialization fails', () => {
      process.env.NODE_ENV = 'production';
      const req = createMockReq();
      const res = createMockRes();
      res.json = vi.fn(() => { throw new Error('Serialization failed'); });
      const next = vi.fn();
      const err = new Error('Original error');

      errorHandler(err, req, res, next);

      expect(res.end).toHaveBeenCalled();
      const fallback = JSON.parse(res.end.mock.calls[0][0]);
      expect(fallback.error).toBe('Internal server error');
      expect(fallback.correlationId).toBe('test-correlation-id-1234');
    });
  });
});
