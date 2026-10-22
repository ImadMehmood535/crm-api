import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';

import { IDatabaseHealth } from './abstraction/IDatabaseHealth';

@Injectable()
export class SequelizeDatabaseHealth implements IDatabaseHealth {
  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  async isUp(): Promise<boolean> {
    try {
      await this.sequelize.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
