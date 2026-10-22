import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';

import { DATABASE_HEALTH } from './abstraction/IDatabaseHealth';
import { UNIT_OF_WORK } from './abstraction/IUnitOfWork';
import { SequelizeDatabaseHealth } from './SequelizeDatabaseHealth';
import { SequelizeUnitOfWork } from './SequelizeUnitOfWork';

/** One Postgres connection for the service. The schema comes from migrations, never from sync. */
@Global()
@Module({
  imports: [
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        dialect: 'postgres' as const,
        uri: config.getOrThrow<string>('DATABASE_URL'),
        autoLoadModels: true,
        synchronize: false,
        logging: false,
      }),
    }),
  ],
  providers: [
    { provide: UNIT_OF_WORK, useClass: SequelizeUnitOfWork },
    { provide: DATABASE_HEALTH, useClass: SequelizeDatabaseHealth },
  ],
  exports: [UNIT_OF_WORK, DATABASE_HEALTH],
})
export class DatabaseModule {}
