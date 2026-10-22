import { permissionCatalogueSeed } from './permission-catalogue.seed';
import { platformIdentitySeed } from './platform-identity.seed';
import { Seed } from './Seed';

/** Ordered list of seeds. Each must be idempotent (ON CONFLICT DO NOTHING / upsert). */
export const SEEDS: readonly Seed[] = [permissionCatalogueSeed, platformIdentitySeed];
