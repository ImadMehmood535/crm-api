import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { PageQuery } from '@application/common/PageQuery';

export class GetRolesRequest extends PageQuery {
  @ApiPropertyOptional({ description: 'Matches the role name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
