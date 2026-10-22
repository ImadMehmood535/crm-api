import { ApiProperty } from '@nestjs/swagger';

import { DeveloperResponse } from '../getdeveloper/DeveloperResponse';

class OnboardedOwnerResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() email!: string;
}

export class OnboardDeveloperResponse {
  @ApiProperty({ type: DeveloperResponse }) developer!: DeveloperResponse;
  @ApiProperty({ type: OnboardedOwnerResponse }) superUser!: OnboardedOwnerResponse;
  @ApiProperty({ description: 'Shown once; the owner must change it at first login' })
  temporaryPassword!: string;

  static of(
    developer: DeveloperResponse,
    superUser: OnboardedOwnerResponse,
    temporaryPassword: string,
  ): OnboardDeveloperResponse {
    return Object.assign(new OnboardDeveloperResponse(), {
      developer,
      superUser,
      temporaryPassword,
    });
  }
}
