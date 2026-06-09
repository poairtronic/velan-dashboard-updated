const { z } = require('zod');

const rowSchema = z
  .object({
    sc: z.string().max(100).optional(),
    po: z.string().max(100).optional(),
    poDate: z.string().max(100).optional(),
    product: z.string().max(500).optional(),
    status1: z.string().max(200).optional(),
    status2: z.string().max(200).optional(),
    currentStage: z.string().max(200).optional(),
    inhouse: z.string().max(200).optional(),
    qty: z.union([z.string().max(50), z.number()]).optional(),
    timestamp: z.string().max(100).optional(),
  })
  .passthrough();

const dataUploadSchema = z.object({
  rows: z.array(rowSchema).min(1, 'Rows array cannot be empty'),
});

const importUploadSchema = z.object({
  rows: z.array(rowSchema).optional(),
  url: z.string().url('Invalid URL format').optional(),
  replace: z.boolean().optional(),
});

module.exports = {
  dataUploadSchema,
  importUploadSchema,
};
