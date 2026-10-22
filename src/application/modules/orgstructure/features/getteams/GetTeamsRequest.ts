import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

import { PageQuery } from '@application/common/PageQuery';

export class GetTeamsRequest extends PageQuery {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'Choose a valid department.' })
  departmentId?: string;
}
