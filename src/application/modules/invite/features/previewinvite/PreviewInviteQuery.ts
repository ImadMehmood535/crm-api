import { IQuery } from '@nestjs/cqrs';

export class PreviewInviteQuery implements IQuery {
  constructor(public readonly token: string) {}
}
