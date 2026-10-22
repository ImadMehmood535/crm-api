import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/** Partial: omitted keys stay, `null` resets a colour to the default. Format is checked in the domain. */
export class UpdateBrandingRequest {
  @ApiPropertyOptional({ nullable: true, example: '#0d9488' })
  @IsOptional()
  @IsString()
  primaryColor?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  secondaryColor?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  accentColor?: string | null;
}
