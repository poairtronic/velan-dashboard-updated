const { z } = require('zod');

const sheetsQuerySchema = z.object({
  url: z.string().url('Invalid Google Sheets URL').refine(val => {
    try {
      const parsed = new URL(val);
      const host = parsed.hostname.toLowerCase();
      return host === 'docs.google.com' || host === 'docs.googleusercontent.com';
    } catch {
      return false;
    }
  }, 'Only Google Sheets URLs from docs.google.com are allowed').optional(),
});

module.exports = {
  sheetsQuerySchema,
};
