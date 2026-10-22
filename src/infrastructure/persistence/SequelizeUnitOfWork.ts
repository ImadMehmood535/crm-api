import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';

import { IUnitOfWork, Tx } from './abstraction/IUnitOfWork';

@Injectable()
export class SequelizeUnitOfWork implements IUnitOfWork {
  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  run<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.sequelize.transaction((transaction) => work(transaction));
  }
}
