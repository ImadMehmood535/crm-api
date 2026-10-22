import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateRoleRequest {
  @ApiProperty({ example: 'HR Assistant', minLength: 2, maxLength: 60 })
  @IsString()
  @Length(2, 60, { message: 'Role name must be 2-60 characters.' })
  name!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Description must be at most 200 characters.' })
  description?: string | null;

  @ApiProperty({ type: [String], example: ['users.view', 'users.create'] })
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  permissions!: string[];
}
