import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString, Length, MaxLength } from 'class-validator';

/** PATCH: omitted fields stay unchanged; `description: null` clears it. */
export class UpdateRoleRequest {
  @ApiPropertyOptional({ minLength: 2, maxLength: 60 })
  @IsOptional()
  @IsString()
  @Length(2, 60, { message: 'Role name must be 2-60 characters.' })
  name?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Description must be at most 200 characters.' })
  description?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  permissions?: string[];
}
