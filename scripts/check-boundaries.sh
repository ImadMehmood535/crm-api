#!/usr/bin/env bash
# Hard-rule checks (ARCHITECTURE.md §16.1). Every check must print nothing. Exit 1 on any violation.
set -u
cd "$(dirname "$0")/.."
fail=0
run() {
  local out; out=$(cat)
  if [ -n "$out" ]; then printf '✗ %s\n%s\n\n' "$1" "$out"; fail=1; else printf '✓ %s\n' "$1"; fi
}
# Exclude test files from layer checks: tests may wire real implementations together.
src() { grep -rnE "$1" "${@:2}" --include='*.ts' | grep -vE '\.(int-)?spec\.ts:'; }

# R1 — adding a runtime dependency means adding it here, in the same PR.
run 'R1 runtime deps allowlist' < <(node -e "
  const allowed = new Set(['@nestjs/common','@nestjs/config','@nestjs/core','@nestjs/cqrs',
    '@nestjs/platform-express','@nestjs/sequelize','@nestjs/swagger','class-transformer',
    'class-validator','jsonwebtoken','pg','reflect-metadata','rxjs','sequelize','sequelize-typescript']);
  const extra = Object.keys(require('./package.json').dependencies || {}).filter((d) => !allowed.has(d));
  if (extra.length) console.log(extra.join('\n'));")
run 'R2 shared is framework-free'      < <(src "from '(@nestjs|sequelize|@api|@application|@domain|@infrastructure)" src/shared)
run 'R3 aggregates are pure'           < <(src "from '(@nestjs|sequelize|@api|@application|@infrastructure)" src/domain | grep -v 'Model.ts:')
run 'R4 application uses abstractions' < <(src "from '(@api/|@infrastructure/(repositories|queries)/[A-Z]|@domain/aggregates/.*Model'|sequelize)" src/application)
run 'R5 api talks to buses only'       < <(src "from '(@infrastructure/|@domain/|sequelize)" src/api)
run 'R6 no HttpException thrown'       < <(src "throw new [A-Za-z]*(HttpException|Exception)\(" src)
run 'R7 timestamps untouched'          < <(src "(createdAt|updatedAt)\s*:" src/infrastructure/repositories 2>/dev/null)
run 'R8 synchronize stays off'         < <(src "synchronize:\s*true|\.sync\(" src seeds)
run 'R9 no buses in handlers'          < <(src "CommandBus|QueryBus" src/application)
run 'R10 no interpolated raw SQL'      < <(src "query\(\s*\`[^\`]*\\$\{" src seeds)
run 'R11 no console'                   < <(src "console\.(log|info|warn|error|debug)" src seeds)
run 'R12 no committed .env'            < <(git ls-files | grep -E '(^|/)\.env$')

exit $fail
