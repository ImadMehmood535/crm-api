export const DATABASE_HEALTH = Symbol('DATABASE_HEALTH');

export interface IDatabaseHealth {
  isUp(): Promise<boolean>;
}
