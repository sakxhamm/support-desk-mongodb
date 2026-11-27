/**
 * Base operational error for predictable HTTP error responses.
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details = null) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Input validation failed', details = []) {
    super(message, 422, 'VALIDATION_ERROR', details);
  }
}

export class PrivacyPolicyError extends AppError {
  constructor(message = 'Privacy policy requirement not met', details = null) {
    super(message, 403, 'PRIVACY_POLICY_VIOLATION', details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}
