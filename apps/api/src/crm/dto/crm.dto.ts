import { z } from 'zod';

export const CreateAccountDtoSchema = z.object({
  name: z.string().min(1, 'Account name is required').max(255),
  domain: z.string().max(255).optional().nullable(),
  industry: z.string().max(100).optional().nullable(),
  annualRevenue: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid decimal amount').optional().nullable(),
  ownerId: z.string().uuid('Invalid owner ID format').optional().nullable(),
});

export type CreateAccountDto = z.infer<typeof CreateAccountDtoSchema>;

export const UpdateAccountDtoSchema = CreateAccountDtoSchema.partial();
export type UpdateAccountDto = z.infer<typeof UpdateAccountDtoSchema>;

export const CreateContactDtoSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email address').max(255).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  jobTitle: z.string().max(100).optional().nullable(),
  accountId: z.string().uuid('Invalid account ID format').optional().nullable(),
  ownerId: z.string().uuid('Invalid owner ID format').optional().nullable(),
});

export type CreateContactDto = z.infer<typeof CreateContactDtoSchema>;

export const UpdateContactDtoSchema = CreateContactDtoSchema.partial();
export type UpdateContactDto = z.infer<typeof UpdateContactDtoSchema>;

export const CreateDealDtoSchema = z.object({
  title: z.string().min(1, 'Deal title is required').max(255),
  value: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Value must be a positive decimal number'),
  currency: z.string().length(3).default('USD'),
  pipelineId: z.string().uuid('Invalid pipeline ID format'),
  stageId: z.string().uuid('Invalid stage ID format'),
  accountId: z.string().uuid('Invalid account ID format').optional().nullable(),
  primaryContactId: z.string().uuid('Invalid primary contact ID format').optional().nullable(),
  ownerId: z.string().uuid('Invalid owner ID format').optional().nullable(),
  expectedCloseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected close date must be YYYY-MM-DD').optional().nullable(),
});

export type CreateDealDto = z.infer<typeof CreateDealDtoSchema>;

export const UpdateDealDtoSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  value: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  currency: z.string().length(3).optional(),
  accountId: z.string().uuid().optional().nullable(),
  primaryContactId: z.string().uuid().optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
  expectedCloseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  lostReason: z.string().optional().nullable(),
  expectedVersion: z.number().int().min(1, 'expectedVersion is required for optimistic concurrency control'),
});

export type UpdateDealDto = z.infer<typeof UpdateDealDtoSchema>;

export const TransitionDealStageDtoSchema = z.object({
  newStageId: z.string().uuid('Invalid target stage ID format'),
  expectedVersion: z.number().int().min(1, 'expectedVersion is required for optimistic concurrency control'),
  lostReason: z.string().optional().nullable(),
});

export type TransitionDealStageDto = z.infer<typeof TransitionDealStageDtoSchema>;

export const CreateActivityDtoSchema = z.object({
  type: z.enum(['note', 'task', 'call', 'stage_change']),
  subject: z.string().min(1, 'Subject is required').max(255),
  body: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  dealId: z.string().uuid('Invalid deal ID format').optional().nullable(),
  contactId: z.string().uuid('Invalid contact ID format').optional().nullable(),
  accountId: z.string().uuid('Invalid account ID format').optional().nullable(),
});

export type CreateActivityDto = z.infer<typeof CreateActivityDtoSchema>;
