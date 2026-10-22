import { IQuery } from '@nestjs/cqrs';

export class GetBrandingAssetQuery implements IQuery {
  constructor(public readonly id: string) {}
}
