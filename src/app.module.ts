import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';

import { ApiModule } from '@api/ApiModule';
import { CommonInfrastructureModule } from '@infrastructure/persistence/CommonInfrastructureModule';
import { DatabaseModule } from '@infrastructure/persistence/DatabaseModule';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CqrsModule.forRoot(),
    DatabaseModule,
    CommonInfrastructureModule,
    ApiModule,
  ],
})
export class AppModule {}
