import { ValidationError } from '../errors/AppError.js';

/**
 * Middleware factory that validates req.params, req.query, and req.body
 * against Zod schemas and replaces them with parsed, type-safe values.
 */
export function validateRequest(schemas) {
  return (req, _res, next) => {
    const issues = [];

    for (const part of ['params', 'query', 'body']) {
      const schema = schemas[part];
      if (!schema) continue;

      const result = schema.safeParse(req[part]);
      if (!result.success) {
        for (const issue of result.error.issues) {
          issues.push({
            location: part,
            field: issue.path.length > 0 ? issue.path.join('.') : part,
            message: issue.message,
            code: issue.code,
          });
        }
      } else {
        req[part] = result.data;
      }
    }

    if (issues.length > 0) {
      return next(new ValidationError('Request validation failed', issues));
    }

    return next();
  };
}
