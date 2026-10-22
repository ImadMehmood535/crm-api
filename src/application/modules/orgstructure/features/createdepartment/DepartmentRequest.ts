import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

const NAME_MESSAGE = 'Name must be 2-100 characters.';
const HEAD_MESSAGE = 'Choose an active department head.';

export class CreateDepartmentRequest {
  @ApiProperty({ example: 'Finance', minLength: 2, maxLength: 100 })
  @IsString()
  @Length(2, 100, { message: NAME_MESSAGE })
  name!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('all', { message: HEAD_MESSAGE })
  headUserId?: string | null;
}

/** PATCH: omitted fields stay unchanged; `headUserId: null` removes the head. */
export class UpdateDepartmentRequest {
  @ApiPropertyOptional({ minLength: 2, maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(2, 100, { message: NAME_MESSAGE })
  name?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('all', { message: HEAD_MESSAGE })
  headUserId?: string | null;
}
