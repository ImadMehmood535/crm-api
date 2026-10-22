import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { UNIT_STATUSES, UNIT_TYPES } from '@domain/aggregates/UnitAggregate/Unit';
import { PageQuery } from '@application/common/PageQuery';

export class GetUnitsRequest extends PageQuery {
  @ApiPropertyOptional({ description: 'Matches number or notes' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: UNIT_STATUSES })
  @IsOptional()
  @IsIn(UNIT_STATUSES)
  status?: string;

  @ApiPropertyOptional({ enum: UNIT_TYPES })
  @IsOptional()
  @IsIn(UNIT_TYPES)
  type?: string;
}
