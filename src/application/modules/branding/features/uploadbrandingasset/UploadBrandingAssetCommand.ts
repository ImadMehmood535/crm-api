import { ICommand } from '@nestjs/cqrs';

import { Actor, RequestMeta } from '@shared/auth/Actor';

export class UploadBrandingAssetCommand implements ICommand {
  constructor(
    public readonly actor: Actor,
    public readonly kind: string,
    public readonly bytes: Buffer,
    public readonly meta: RequestMeta,
  ) {}
}
