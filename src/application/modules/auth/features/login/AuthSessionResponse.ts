import { ApiProperty } from '@nestjs/swagger';

import { AuthUserResponse } from '../getme/AuthUserResponse';

/** The frontend's `AuthSession`. The Next route handlers move `refreshToken` into a cookie. */
export class AuthSessionResponse {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ example: 900, description: 'Access token lifetime in seconds' })
  expiresIn!: number;
  @ApiProperty({ type: AuthUserResponse }) user!: AuthUserResponse;

  static of(
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
    user: AuthUserResponse,
  ): AuthSessionResponse {
    return Object.assign(new AuthSessionResponse(), { accessToken, refreshToken, expiresIn, user });
  }
}
