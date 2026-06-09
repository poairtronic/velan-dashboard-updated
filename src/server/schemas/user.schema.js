const { z } = require('zod');

const adminCreateSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain alphanumeric characters and underscores'),
  password: z.string().min(4, 'Password must be at least 4 characters').max(100),
  role: z.enum(['admin', 'user']),
});

const updateStatusSchema = z.object({
  status: z.enum(['approved', 'denied']),
});

module.exports = {
  adminCreateSchema,
  updateStatusSchema,
};
