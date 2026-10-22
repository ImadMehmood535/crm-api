import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_WEEKS = 8;

export class GetPlatformStatsRequest {
  @ApiPropertyOptional({ default: DEFAULT_WEEKS, minimum: 1, maximum: 26 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(26)
  weeks: number = DEFAULT_WEEKS;
}
