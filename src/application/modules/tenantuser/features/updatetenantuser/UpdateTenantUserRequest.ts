import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, Length } from 'class-validator';

/** PATCH: omitted fields stay unchanged. The email cannot be changed. */
export class UpdateTenantUserRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100, { message: 'First name is required.' })
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100, { message: 'Last name is required.' })
  lastName?: string;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true, message: 'One or more roles do not exist.' })
  roleIds?: string[];
}
