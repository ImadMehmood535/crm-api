import { ModuleMetadata } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';

import { DatabaseModule } from '../../src/infrastructure/persistence/DatabaseModule';

/** A testing module with the real database plus the given persistence modules. */
export async function persistenceModule(
  imports: ModuleMetadata['imports'],
): Promise<{ moduleRef: TestingModule; sequelize: Sequelize }> {
  const moduleRef = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, ...(imports ?? [])],
  }).compile();
  await moduleRef.init();
  return { moduleRef, sequelize: moduleRef.get(Sequelize) };
}
