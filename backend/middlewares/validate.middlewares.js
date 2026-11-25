/**
 * Request validation with zod schemas (AUDIT_REPORT.md, SEC-24 / SEC-25).
 *
 *   router.put('/:id', validate({ params: idParams, body: categoryUpdate }), controller)
 *
 * - body / params are replaced by the parsed values: unknown fields are
 *   dropped (no mass assignment) and values are trimmed / coerced.
 * - query is exposed as req.validatedQuery (req.query is read-only in Express 5).
 * - Invalid input -> 400 { message, errors: [{ field, message }] } without
 *   internal details. A file already stored on disk by multer is removed.
 *
 * For multipart routes place it after multer (fields are parsed there) and
 * before persistUpload, so nothing is uploaded for an invalid request.
 */
const fs = require('fs');

function formatIssues(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

function discardUploadedFile(req) {
  if (req.file && req.file.path) {
    fs.unlink(req.file.path, () => {});
  }
}

function validate(schemas) {
  return (req, res, next) => {
    for (const part of ['params', 'body', 'query']) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] === undefined ? {} : req[part]);
      if (!result.success) {
        discardUploadedFile(req);
        const errors = formatIssues(result.error);
        const first = errors[0];
        return res.status(400).json({
          message: `Invalid input: ${first.field === '(root)' ? '' : `${first.field}: `}${first.message}`,
          errors,
        });
      }
      if (part === 'query') req.validatedQuery = result.data;
      else if (part === 'params') Object.assign(req.params, result.data);
      else req.body = result.data;
    }
    next();
  };
}

module.exports = { validate };
