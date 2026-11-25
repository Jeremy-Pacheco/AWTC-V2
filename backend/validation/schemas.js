/**
 * Input schemas for the API (used with middlewares/validate.middlewares.js).
 * Only the fields listed here reach the controllers; anything else in the
 * request is dropped. Limits are generous for real use but bounded.
 */
const { z } = require('zod');

// Multipart forms send everything as strings, and empty inputs as "".
const blankToUndefined = (value) => (value === '' || value === null ? undefined : value);
const optional = (schema) => z.preprocess(blankToUndefined, schema.optional());

const text = (max) => z.string({ required_error: 'is required', invalid_type_error: 'must be text' })
  .trim()
  .min(1, 'must not be empty')
  .max(max, `must be at most ${max} characters`);

const email = z.string({ required_error: 'is required' }).trim()
  .max(254, 'must be at most 254 characters')
  .email('must be a valid email');

const id = z.coerce.number({ invalid_type_error: 'must be a number' })
  .int('must be an integer')
  .positive('must be a positive id')
  .max(2147483647, 'is out of range');

// Free text that may be cleared: "" is kept (stored as empty), only length is bounded
const clearableText = (max) => z.string({ invalid_type_error: 'must be text' })
  .trim()
  .max(max, `must be at most ${max} characters`)
  .optional();

const atLeastOneField = (schema) => schema.refine(
  (data) => Object.values(data).some((value) => value !== undefined),
  { message: 'No valid fields to update' }
);

/* ---------- URL params ---------- */
const idParams = z.object({ id });
const projectUserParams = z.object({ id, userId: id });
const userIdParams = z.object({ userId: id });
const messageIdParams = z.object({ messageId: id });

/* ---------- Categories ---------- */
const categoryCreate = z.object({
  name: text(100),
  description: clearableText(1000),
});
const categoryUpdate = atLeastOneField(categoryCreate.partial());

/* ---------- Contacts ---------- */
const contactCreate = z.object({
  name: text(100),
  email,
  subject: optional(text(200)),
  message: text(5000),
});
// Admins can only mark messages as read/unread
const contactUpdate = z.object({
  read: z.boolean({ required_error: 'is required', invalid_type_error: 'must be true or false' }),
});

/* ---------- Projects ---------- */
const PROJECT_STATUSES = ['active', 'cancelled', 'finished'];
const projectStatus = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  z.enum(PROJECT_STATUSES, { errorMap: () => ({ message: `must be one of: ${PROJECT_STATUSES.join(', ')}` }) })
);
const date = z.coerce.date({ errorMap: () => ({ message: 'must be a valid date' }) });

const projectFields = {
  name: text(150),
  description: clearableText(5000),
  start_date: optional(date),
  end_date: optional(date),
  location: clearableText(200),
  capacity: optional(z.coerce.number({ invalid_type_error: 'must be a number' })
    .int('must be an integer').min(1, 'must be at least 1').max(10000, 'must be at most 10000')),
  status: optional(projectStatus),
  categoryId: optional(id),
};
const datesInOrder = (data) => !(data.start_date && data.end_date) || data.end_date >= data.start_date;
const datesMessage = { message: 'end_date must not be before start_date', path: ['end_date'] };

const projectCreate = z.object(projectFields).refine(datesInOrder, datesMessage);
// Updates may omit any field (a new image alone is a valid update)
const projectUpdate = z.object(projectFields).partial().refine(datesInOrder, datesMessage);

/* ---------- Reviews ---------- */
const reviewCreate = z.object({ content: text(2000) });
const reviewUpdate = z.object({
  content: optional(text(2000)),
  removeImage: optional(z.enum(['true', 'false']).transform((value) => value === 'true')),
});

/* ---------- Users ---------- */
// The password policy itself lives in services/auth.service.js
const password = z.string({ required_error: 'is required', invalid_type_error: 'must be text' })
  .min(1, 'is required').max(200, 'is too long');
const ROLES = ['volunteer', 'coordinator', 'admin'];

const signup = z.object({
  name: optional(text(100)),
  firstName: optional(text(50)),
  lastName: optional(text(50)),
  email,
  password,
}).refine((data) => data.name || (data.firstName && data.lastName), {
  message: 'name (or firstName and lastName) is required',
  path: ['name'],
});
const coordinatorCreate = z.object({ name: text(100), email, password });
const roleUpdate = z.object({
  role: z.enum(ROLES, { errorMap: () => ({ message: `must be one of: ${ROLES.join(', ')}` }) }),
});
const profileUpdate = z.object({ name: optional(text(100)) });

/* ---------- Push subscriptions ---------- */
const pushEndpoint = z.string({ required_error: 'is required' }).trim()
  .max(2048, 'is too long')
  .url('must be a URL')
  .refine((value) => value.startsWith('https://'), 'must use https');
const subscribe = z.object({
  endpoint: pushEndpoint,
  expirationTime: z.number().int().nonnegative().nullable().optional(),
  keys: z.object({ p256dh: text(200), auth: text(100) }, { required_error: 'is required' }),
});
const unsubscribe = z.object({ endpoint: pushEndpoint });

module.exports = {
  idParams,
  projectUserParams,
  userIdParams,
  messageIdParams,
  categoryCreate,
  categoryUpdate,
  contactCreate,
  contactUpdate,
  projectCreate,
  projectUpdate,
  PROJECT_STATUSES,
  reviewCreate,
  reviewUpdate,
  signup,
  coordinatorCreate,
  roleUpdate,
  profileUpdate,
  subscribe,
  unsubscribe,
};
