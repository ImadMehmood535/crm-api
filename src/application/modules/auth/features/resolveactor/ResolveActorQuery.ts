import { IQuery } from '@nestjs/cqrs';

export class ResolveActorQuery implements IQuery {
  constructor(public readonly accessToken: string) {}
}
