import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { TokenService, AccessTokenPayload } from '../token-service';

export interface AuthenticatedRequest {
  headers: Record<string, string | undefined>;
  user?: AccessTokenPayload;
  raw?: any;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly tokenService: TokenService;

  constructor(tokenService?: TokenService) {
    this.tokenService = tokenService || new TokenService();
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers['authorization'] || request.headers['Authorization'];

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException('Authorization header is missing');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      throw new UnauthorizedException('Authorization header must use Bearer scheme');
    }

    const token = parts[1];

    try {
      const payload = this.tokenService.verifyAccessToken(token);
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
