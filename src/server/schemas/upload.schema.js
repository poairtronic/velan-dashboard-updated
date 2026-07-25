const { z } = require('zod');

const flexField = z.union([z.string(), z.number(), z.null()]).optional();

const rowSchema = z
  .object({
    sc: flexField,
    po: flexField,
    poDate: flexField,
    product: flexField,
    status1: flexField,
    status2: flexField,
    currentStage: flexField,
    inhouse: flexField,
    qty: flexField,
    timestamp: flexField,
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
