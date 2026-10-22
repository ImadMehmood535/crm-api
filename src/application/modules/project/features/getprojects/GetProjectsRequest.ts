import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { PROJECT_STATUSES } from '@domain/aggregates/ProjectAggregate/Project';
import { PageQuery } from '@application/common/PageQuery';

export class GetProjectsRequest extends PageQuery {
  @ApiPropertyOptional({ description: 'Matches name or city' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: PROJECT_STATUSES })
  @IsOptional()
  @IsIn(PROJECT_STATUSES)
  status?: string;
}
