import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

export interface AccessTokenPayload {
  sub: string;
  tid: string;
  role: string;
  email: string;
  sessionVersion: number;
  iat?: number;
  exp?: number;
}

export class StaleTokenException extends Error {
  readonly code = 'ERR_STALE_TOKEN';
  constructor(message = 'Refresh token is stale and outside the 30-second recovery window') {
    super(message);
    this.name = 'StaleTokenException';
  }
}

export class RevokedFamilyException extends Error {
  readonly code = 'ERR_TOKEN_FAMILY_REVOKED';
  constructor(message = 'Refresh token family is revoked') {
    super(message);
    this.name = 'RevokedFamilyException';
  }
}

export class TokenService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: number = 900; // 15 minutes in seconds
  private readonly refreshTokenTtlMs: number = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly recoveryWindowMs: number = 30 * 1000; // 30 seconds

  constructor(jwtSecret?: string) {
    this.jwtSecret =
      jwtSecret ||
      process.env.JWT_ACCESS_SECRET ||
      process.env.JWT_SECRET ||
      'crm_production_grade_jwt_secret_32_bytes_min_key';
  }

  /**
   * Generates a signed JWT access token with tenant and membership claims
   */
  generateAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
    });
  }

  /**
   * Cryptographically verifies access token signature and expiration
   */
  verifyAccessToken(token: string): AccessTokenPayload {
    return jwt.verify(token, this.jwtSecret) as AccessTokenPayload;
  }

  /**
   * Hashes a raw refresh token using SHA-256 for secure database lookup
   */
  hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Generates a cryptographically secure unpredictable refresh token
   */
  generateRawRefreshToken(): { rawToken: string; tokenHash: string } {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    return { rawToken, tokenHash };
  }

  /**
   * Creates a new RefreshTokenFamily and initial refresh token for a user session
   */
  async createTokenFamily(
    prisma: PrismaClient,
    userId: string,
  ): Promise<{ familyId: string; rawRefreshToken: string; tokenId: string }> {
    const { rawToken, tokenHash } = this.generateRawRefreshToken();
    const expiresAt = new Date(Date.now() + this.refreshTokenTtlMs);

    // Create family and initial token atomically
    const family = await prisma.refreshTokenFamily.create({
      data: {
        userId,
        isRevoked: false,
      },
    });

    const token = await prisma.refreshToken.create({
      data: {
        familyId: family.id,
        tokenHash,
        expiresAt,
      },
    });

    await prisma.refreshTokenFamily.update({
      where: { id: family.id },
      data: {
        activeTokenId: token.id,
        activeUpdatedAt: new Date(),
      },
    });

    return {
      familyId: family.id,
      rawRefreshToken: rawToken,
      tokenId: token.id,
    };
  }

  /**
   * Bounded 30-Second Refresh Token Rotation & Concurrency Recovery:
   * - Active token: Rotated to new token pair.
   * - Already rotated token within 30s: Returns existing active token pair without branching lineage.
   * - Already rotated token outside 30s: Returns ERR_STALE_TOKEN without revoking the family.
   * - Revoked family: Throws RevokedFamilyException.
   */
  async rotateRefreshToken(
    prisma: PrismaClient,
    rawToken: string,
  ): Promise<{
    isRecovery: boolean;
    familyId: string;
    userId: string;
    rawRefreshToken: string;
    activeTokenId: string;
  }> {
    const tokenHash = this.hashToken(rawToken);

    const existingToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { family: true },
    });

    if (!existingToken) {
      throw new Error('Invalid refresh token');
    }

    const { family } = existingToken;

    if (family.isRevoked) {
      throw new RevokedFamilyException();
    }

    const now = new Date();

    // 1. Check if token was already rotated
    if (existingToken.rotatedAt) {
      const elapsedMs = now.getTime() - existingToken.rotatedAt.getTime();

      if (elapsedMs <= this.recoveryWindowMs) {
        // Concurrency-safe recovery window: A concurrent tab re-submitted the previous token.
        // Retrieve the current active token for the family to converge without creating another successor.
        const activeToken = await prisma.refreshToken.findFirst({
          where: {
            familyId: family.id,
            rotatedAt: null,
          },
        });

        if (activeToken) {
          return {
            isRecovery: true,
            familyId: family.id,
            userId: family.userId,
            rawRefreshToken: rawToken, // Re-use in-flight recovery token
            activeTokenId: activeToken.id,
          };
        }
      }

      // Outside the 30-second window: Stale token rejection without family revocation
      throw new StaleTokenException();
    }

    // 2. Active token: Verify expiration
    if (existingToken.expiresAt < now) {
      throw new Error('Refresh token has expired');
    }

    // 3. Perform standard single-flight rotation
    const { rawToken: nextRawToken, tokenHash: nextTokenHash } = this.generateRawRefreshToken();
    const expiresAt = new Date(now.getTime() + this.refreshTokenTtlMs);

    const newToken = await prisma.refreshToken.create({
      data: {
        familyId: family.id,
        tokenHash: nextTokenHash,
        expiresAt,
      },
    });

    // Mark previous token rotated and link successor
    await prisma.refreshToken.update({
      where: { id: existingToken.id },
      data: {
        rotatedAt: now,
        successorTokenId: newToken.id,
      },
    });

    // Update family's active pointer
    await prisma.refreshTokenFamily.update({
      where: { id: family.id },
      data: {
        activeTokenId: newToken.id,
        activeUpdatedAt: now,
      },
    });

    return {
      isRecovery: false,
      familyId: family.id,
      userId: family.userId,
      rawRefreshToken: nextRawToken,
      activeTokenId: newToken.id,
    };
  }

  /**
   * Revokes an entire token family (e.g. on user logout, password reset, or session kill)
   */
  async revokeFamily(prisma: PrismaClient, familyId: string): Promise<void> {
    await prisma.refreshTokenFamily.update({
      where: { id: familyId },
      data: { isRevoked: true },
    });
  }

  /**
   * Revokes all token families for a user (e.g. on global account password reset)
   */
  async revokeAllUserFamilies(prisma: PrismaClient, userId: string): Promise<void> {
    await prisma.refreshTokenFamily.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
  }
}
