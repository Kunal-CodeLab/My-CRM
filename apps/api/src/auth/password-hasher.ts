import * as argon2 from 'argon2';

/**
 * Standard OWASP-recommended Argon2id configuration for commercial SaaS CRM
 */
export const ARGON2_CONFIG: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,       // 3 iterations
  parallelism: 1,    // 1 lane
  hashLength: 32,
};

export class PasswordHasher {
  /**
   * Hashes a plaintext password using Argon2id
   */
  static async hash(password: string): Promise<string> {
    return argon2.hash(password, { ...ARGON2_CONFIG, raw: false });
  }

  /**
   * Verifies a plaintext password against an Argon2id hash with constant-time equality
   */
  static async verify(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }
}
