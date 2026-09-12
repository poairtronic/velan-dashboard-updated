const { z } = require('zod');

const adminCreateSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50)
    .regex(/^[a-zA-Z0-9_ ]+$/, 'Username can only contain alphanumeric characters, spaces and underscores'),
  password: z.string().min(4, 'Password must be at least 4 characters').max(100),
  role: z.string().default('user'),
  allowed_modules: z.array(z.string()).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['approved', 'denied']),
});

const updateUserModulesSchema = z.object({
  allowed_modules: z.array(z.string()),
  role: z.string().optional(),
});

module.exports = {
  adminCreateSchema,
  updateStatusSchema,
  updateUserModulesSchema,
};
