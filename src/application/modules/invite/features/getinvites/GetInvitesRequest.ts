import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { PageQuery } from '@application/common/PageQuery';

export class GetInvitesRequest extends PageQuery {
  @ApiPropertyOptional({ enum: ['pending', 'accepted', 'revoked', 'expired'] })
  @IsOptional()
  @IsIn(['pending', 'accepted', 'revoked', 'expired'])
  status?: string;
}
