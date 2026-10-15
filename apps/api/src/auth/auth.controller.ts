import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service';
import { JwtAuthGuard, AuthenticatedRequest } from './guards/jwt-auth.guard';
import { TenantMembershipGuard } from './guards/tenant-membership.guard';
import {
  RegisterDtoSchema,
  LoginDtoSchema,
  SwitchOrganizationDtoSchema,
  AcceptInvitationDtoSchema,
} from './dto/auth.dto';

const COOKIE_NAME = 'refresh_token';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setRefreshTokenCookie(reply: FastifyReply, token: string) {
    // In Fastify, cookies are set via setCookie if @fastify/cookie is registered,
    // or via standard Set-Cookie header.
    const isProd = process.env.NODE_ENV === 'production';
    const cookieHeader = `${COOKIE_NAME}=${token}; Path=/api/v1/auth; HttpOnly; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}${isProd ? '; Secure' : ''}`;
    reply.header('Set-Cookie', cookieHeader);
  }

  private clearRefreshTokenCookie(reply: FastifyReply) {
    const isProd = process.env.NODE_ENV === 'production';
    const cookieHeader = `${COOKIE_NAME}=; Path=/api/v1/auth; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${isProd ? '; Secure' : ''}`;
    reply.header('Set-Cookie', cookieHeader);
  }

  private extractRefreshToken(req: FastifyRequest): string | null {
    // Check cookies from header
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
      if (match) {
        return match[1];
      }
    }
    // Check body fallback if cookies not supported in test environment
    const body = req.body as any;
    if (body && body.refreshToken) {
      return body.refreshToken;
    }
    return null;
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() rawBody: unknown, @Res({ passthrough: true }) reply: FastifyReply) {
    const parseResult = RegisterDtoSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.errors.map((e) => e.message).join(', '));
    }

    const { response, rawRefreshToken } = await this.authService.register(parseResult.data);
    this.setRefreshTokenCookie(reply, rawRefreshToken);
    return response;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() rawBody: unknown, @Res({ passthrough: true }) reply: FastifyReply) {
    const parseResult = LoginDtoSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.errors.map((e) => e.message).join(', '));
    }

    const { response, rawRefreshToken } = await this.authService.login(parseResult.data);
    this.setRefreshTokenCookie(reply, rawRefreshToken);
    return response;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const token = this.extractRefreshToken(req);
    if (!token) {
      throw new UnauthorizedException('Refresh token is missing');
    }

    const { response, rawRefreshToken } = await this.authService.refresh(token);
    this.setRefreshTokenCookie(reply, rawRefreshToken);
    return response;
  }

  @Post('switch-organization')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async switchOrganization(@Req() req: AuthenticatedRequest, @Body() rawBody: unknown) {
    const parseResult = SwitchOrganizationDtoSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.errors.map((e) => e.message).join(', '));
    }

    return this.authService.switchOrganization(req.user!.sub, parseResult.data.targetTenantId);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const token = this.extractRefreshToken(req);
    if (token) {
      await this.authService.logout(token);
    }
    this.clearRefreshTokenCookie(reply);
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, TenantMembershipGuard)
  async getProfile(@Req() req: AuthenticatedRequest) {
    return this.authService.getProfile(req.user!.sub, req.user!.tid);
  }
}

@Controller('api/v1/invitations')
export class InvitationsController {
  constructor(private readonly authService: AuthService) {}

  @Post('accept')
  @HttpCode(HttpStatus.OK)
  async accept(@Body() rawBody: unknown) {
    const parseResult = AcceptInvitationDtoSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.errors.map((e) => e.message).join(', '));
    }

    const result = await this.authService.acceptInvitation(parseResult.data);
    return { success: true, ...result };
  }
}
