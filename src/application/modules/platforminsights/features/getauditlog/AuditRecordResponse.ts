import { ApiProperty } from '@nestjs/swagger';

class AuditActorResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() name!: string;
}

export class AuditRecordResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ example: 'developer.suspended' }) action!: string;
  @ApiProperty({ example: 'organization' }) entityType!: string;
  @ApiProperty({ nullable: true, type: String }) entityId!: string | null;
  @ApiProperty({ nullable: true, type: String }) organizationId!: string | null;
  @ApiProperty({ nullable: true, type: String }) organizationName!: string | null;
  @ApiProperty({ type: AuditActorResponse, nullable: true }) actor!: AuditActorResponse | null;
  @ApiProperty({ nullable: true, type: Object }) oldValues!: Record<string, unknown> | null;
  @ApiProperty({ nullable: true, type: Object }) newValues!: Record<string, unknown> | null;
  @ApiProperty({ nullable: true, type: String }) ip!: string | null;
}
