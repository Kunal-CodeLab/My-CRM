import { z } from 'zod';

export const RegisterDtoSchema = z.object({
  email: z.string().email('Valid email address is required').max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  organizationName: z.string().min(2, 'Organization name must be at least 2 characters').max(255),
  organizationSlug: z
    .string()
    .min(2, 'Organization slug must be at least 2 characters')
    .max(63)
    .regex(/^[a-z0-9-]+$/, 'Slug must consist of lowercase letters, digits, and hyphens'),
});

export type RegisterDto = z.infer<typeof RegisterDtoSchema>;

export const LoginDtoSchema = z.object({
  email: z.string().email('Valid email address is required'),
  password: z.string().min(1, 'Password is required'),
  tenantId: z.string().uuid('Invalid tenant ID format').optional(),
});

export type LoginDto = z.infer<typeof LoginDtoSchema>;

export const SwitchOrganizationDtoSchema = z.object({
  targetTenantId: z.string().uuid('Invalid target tenant ID format'),
});

export type SwitchOrganizationDto = z.infer<typeof SwitchOrganizationDtoSchema>;

export const AcceptInvitationDtoSchema = z.object({
  invitationToken: z.string().min(1, 'Invitation token is required'),
  password: z.string().min(8).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
});

export type AcceptInvitationDto = z.infer<typeof AcceptInvitationDtoSchema>;

export const PasswordResetRequestDtoSchema = z.object({
  email: z.string().email('Valid email address is required'),
});

export type PasswordResetRequestDto = z.infer<typeof PasswordResetRequestDtoSchema>;

export const PasswordResetConfirmDtoSchema = z.object({
  resetToken: z.string().min(1, 'Reset token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit'),
});

export type PasswordResetConfirmDto = z.infer<typeof PasswordResetConfirmDtoSchema>;
