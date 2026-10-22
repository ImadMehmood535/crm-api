import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

/** The endpoint needs no access token (login, refresh, public invites, health). */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);
