# CRM Developer API — Architecture Guide

> Binding architecture for `crm-developer-api`. It is a multi-tenant SaaS CRM for real-estate
> developers, with two planes: **platform** (Invespy operators) and **tenant** (a developer
> company's staff).
>
> **Style:** NestJS 11 · DDD (aggregates + guards) · CQRS (`@nestjs/cqrs`) · Vertical Slice (one folder
> per use case) · Sequelize (`sequelize-typescript`) on PostgreSQL 16 · plain SQL migrations.
>
> **Contract first.** The frontend (`../crm-developer-ui`) already exists. Its HTTP contract
> (`memory-bank/api-contract-v1.md`) and MSW handlers (`src/mocks/`) define what every endpoint must
> accept and return. When this guide and the contract disagree on an HTTP detail, the contract wins.
>
> **Sections 1–14** define the architecture. **Sections 15–19** define coding practices, rules and
> boundaries, testing, the PR process and the PR scoring system. All of them are binding, for humans
> and AI assistants alike.

---

## 1. Tech stack

| Concern         | Choice |
| --------------- | ------ |
| Framework       | `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` |
| CQRS            | `@nestjs/cqrs` (`CommandBus`, `QueryBus`; `CqrsModule.forRoot()` once in `AppModule`) |
| Config          | `@nestjs/config` (`ConfigModule.forRoot({ isGlobal: true })`, `.env`) |
| ORM             | `@nestjs/sequelize`, `sequelize`, `sequelize-typescript`, `pg` |
| Schema          | Plain SQL files in `migrations/`, applied by our own runner (§7.2) |
| Request validation | `class-validator` + `class-transformer` on Request DTOs (§4.4) |
| API docs        | `@nestjs/swagger` at `/docs` |
| Path aliases    | `tsconfig.json` `paths`, `tsc-alias` at build, `tsconfig-paths` for `ts-node` |
| Tests           | `jest` + `ts-jest`, `supertest` for e2e (§17) |
| Lint / format   | ESLint 9 (`typescript-eslint` type-checked) + Prettier |

**Dependencies.** Prefer Node built-ins and our own small helpers (UUID v7, migrator). Add a library
only when the change that needs it justifies it in `design.md`: auth (JWT, password hashing) is the
expected case. Every runtime dependency must be in the R1 allowlist (§16.1). Adding one means
editing that list in the same PR, so the reviewer sees it.

---

## 2. Top-level layout

```
crm-developer-api/
├── .env.example                 # PORT, DATABASE_URL, DATABASE_URL_TEST, …
├── docker-compose.yml           # postgres:16-alpine on host port 5436 (+ *_test database)
├── migrations/                  # 0001_init.sql, 0002_….sql — forward-only, applied in name order
├── seeds/                       # idempotent TypeScript seeds (index.ts lists them; seed.cli.ts runs them)
├── scripts/check-boundaries.sh  # hard-rule checks (§16.1)
├── test/                        # e2e specs + jest global setup
└── src/
    ├── main.ts                  # bootstrap + Swagger
    ├── app.setup.ts             # prefix, pipes, filter, interceptor (shared with e2e tests)
    ├── app.module.ts            # Config + CQRS + Database + Api
    │
    ├── api/                     # HTTP edge (thin)
    │   ├── ApiModule.ts
    │   ├── common/              # ApiConstants, PageQuery, RawResponse, CurrentActor, auth decorators
    │   ├── controllers/<Entity>Controller.ts
    │   ├── filters/AllExceptionsFilter.ts
    │   ├── interceptors/EnvelopeInterceptor.ts
    │   ├── middleware/RequestLoggerMiddleware.ts
    │   └── pipes/{ParseUuidPipe,createValidationPipe}.ts
    │
    ├── application/             # vertical slices (CQRS)
    │   └── modules/<entity>/
    │       ├── <Entity>Module.ts
    │       └── features/<featurename>/
    │           ├── <Feature>Command.ts | <Feature>Query.ts
    │           ├── <Feature>CommandHandler.ts | <Feature>QueryHandler.ts
    │           ├── <Feature>Request.ts      (when there is a body or query DTO)
    │           └── <Feature>Response.ts
    │
    ├── domain/                  # pure business model
    │   └── aggregates/
    │       ├── BaseModel.ts
    │       └── <Entity>Aggregate/
    │           ├── <Entity>.ts          # domain aggregate (rules)
    │           ├── <Entity>Model.ts     # Sequelize table model
    │           └── <Join>Model.ts       # join-table model owned by this aggregate (optional)
    │
    ├── infrastructure/
    │   ├── persistence/
    │   │   ├── DatabaseModule.ts        # global: connection, UNIT_OF_WORK, DATABASE_HEALTH
    │   │   ├── abstraction/{IUnitOfWork,IDatabaseHealth}.ts
    │   │   ├── SequelizeUnitOfWork.ts · SequelizeDatabaseHealth.ts
    │   │   ├── migrator.ts · migrate.cli.ts
    │   │   └── <Entity>PersistenceModule.ts
    │   ├── repositories/        # WRITE side (aggregates in/out)
    │   │   ├── abstraction/I<Entity>Repository.ts
    │   │   └── <Entity>Repository.ts
    │   └── queries/             # READ side (plain read models out)
    │       ├── abstraction/I<Entity>Queries.ts
    │       └── <Entity>Queries.ts
    │
    └── shared/                  # framework-free helpers
        ├── auth/Actor.ts        # who is calling (§8.7)
        ├── domain/Guards.ts
        ├── errors/AppError.ts
        └── utils/{Uuid,Pagination}.ts
```

### Path aliases (`tsconfig.json` + jest `moduleNameMapper`)

```json
"paths": {
  "@api/*":            ["./src/api/*"],
  "@application/*":    ["./src/application/*"],
  "@domain/*":         ["./src/domain/*"],
  "@infrastructure/*": ["./src/infrastructure/*"],
  "@shared/*":         ["./src/shared/*"]
}
```

Use aliases for cross-layer imports, and relative `./` imports only **inside the same folder**
(a slice, or an `api/` sub-folder importing a sibling such as `../common/RawResponse`).

---

## 3. Layers and dependency rules

```
         HTTP
          │
   ┌──────▼──────┐   validates DTO, builds Command/Query, sends it on the bus
   │    api/     │
   └──────┬──────┘
          │ CommandBus / QueryBus
   ┌──────▼──────────────┐
   │ application/ slices │── uses ──► domain/ aggregate (write side)
   └──────┬──────────────┘
          │ @Inject(SYMBOL) interface
   ┌──────▼──────────────┐
   │  infrastructure/    │── maps Model ⇄ Aggregate / ReadModel
   └──────┬──────────────┘
          │ Sequelize
       Postgres

   shared/ is usable from every layer and depends on nothing outside itself.
```

| Layer | May import | Must NOT |
| ----- | ---------- | -------- |
| `shared` | its own files only | import Nest, Sequelize or other layers |
| `domain` (`<Entity>.ts`) | `@shared/*` | import Nest, Sequelize or infrastructure |
| `domain` (`*Model.ts`) | `sequelize-typescript`, `BaseModel`, other Models | contain business rules |
| `infrastructure` | `@domain/*`, `@shared/*`, Sequelize | contain business rules or throw HTTP exceptions |
| `application` | `@domain/<X>Aggregate/<X>` (aggregates), `@infrastructure/**/abstraction/*`, `@shared/*` | import concrete repositories, queries, Models or `sequelize` |
| `api` | `@application/**` (Commands, Queries, Requests, Responses, Modules), `@shared/*` | inject repositories or contain logic beyond input mapping |

Key principles:

1. **Controllers are thin.** They only map validated HTTP input and the caller (`Actor`) to a
   Command or Query.
2. **Handlers orchestrate.** They check permission and scope, load the aggregate, call domain
   methods, persist, and return a Response.
3. **Aggregates own the rules.** Every business invariant lives in an aggregate method, using `Guards`.
4. **Write side ≠ read side.** Commands use a *Repository* (aggregates in and out). Queries use a
   *Queries* class (plain `ReadModel` objects out). Never return a Sequelize model from either.
5. **Depend on abstractions.** Handlers inject `I<Entity>Repository` / `I<Entity>Queries` /
   `IUnitOfWork` through `Symbol` tokens.
6. **Every tenant query is scoped.** Tenant-owned data is always read and written with the caller's
   `organizationId` (§8.7).

---

## 4. Bootstrap & HTTP conventions

### 4.1 `src/main.ts` and `src/app.setup.ts`
```ts
// app.setup.ts — shared by main.ts and every e2e test
export const API_PREFIX = 'api/v1';

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX, { exclude: ['health'] });
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new EnvelopeInterceptor(app.get(Reflector)));
}
```
`main.ts` creates the app, calls `configureApp`, mounts Swagger at `/docs` and listens on
`PORT` (default **3000**). `AppModule` imports `ConfigModule.forRoot({ isGlobal: true })`,
`CqrsModule.forRoot()`, `DatabaseModule` and `ApiModule`.

### 4.2 Success envelope (`EnvelopeInterceptor`)
| Handler returns | Body |
| --------------- | ---- |
| an object | `{ "success": true, "data": { … } }` |
| `undefined` / `null` | `{ "success": true, "data": null }` |
| `PagedResult` | `{ "success": true, "data": [ … ], "meta": { "page", "pageSize", "total" } }` |

`@RawResponse()` opts a handler out of the envelope. It is used for `/health` and binary files.

### 4.3 Errors (`AppError` → `AllExceptionsFilter`)
Application and domain code throw only `AppError` subclasses from `@shared/errors/AppError`.
**Never throw Nest `HttpException`s.** The filter renders
`{ "success": false, "error": { "code", "message", "details"? } }`.

| Class | Status | Code | Typical use |
| ----- | ------ | ---- | ----------- |
| `ValidationFailedError` | 422 | `VALIDATION_FAILED` | invalid input (`details[]` per field) |
| `BadRequestError` | 400 | `BAD_REQUEST` (or given) | malformed request |
| `UnauthenticatedError` | 401 | `UNAUTHENTICATED` (or given, e.g. `INVALID_CREDENTIALS`) | no or invalid credentials |
| `ForbiddenError` | 403 | given (`PERMISSION_DENIED`, `FORBIDDEN_OPERATION`, …) | not allowed |
| `NotFoundError` | 404 | `NOT_FOUND` (or given, e.g. `INVITE_INVALID`) | missing, **or another tenant's** row |
| `ConflictError` | 409 | given (`SLUG_CONFLICT`, `EMAIL_CONFLICT`, …) | uniqueness, state conflicts |

The filter also maps:
- an unknown route to 404 `NOT_FOUND`;
- a body-parser failure to 400 `BAD_REQUEST`;
- 413 to `PAYLOAD_TOO_LARGE` and 415 to `UNSUPPORTED_MEDIA_TYPE`;
- anything else to 500 `INTERNAL_ERROR`, with a generic message. The detail is logged, never returned.

Codes are part of the frontend contract. Use the exact code the contract names.

### 4.4 Validation
- **Request shape** (types, formats, lengths, required fields, unknown properties) is validated by
  `class-validator` decorators on the Request DTO. The global pipe (`whitelist`,
  `forbidNonWhitelisted`, `transform`) reports **every** bad field in one 422. Nested fields use dot
  notation (`superUser.email`).
- **Business invariants** live in the aggregate through `Guards`. These throw
  `ValidationFailedError.forField(field, message)`.
- **Rules needing the database** (uniqueness, parent exists, in use) live in the handler, which calls
  the repository and throws `ConflictError` / `NotFoundError`.
- Path ids go through `ParseUuidPipe`: a malformed id is a 404, the same as an unknown one.

### 4.5 Pagination
List query DTOs extend `PageQuery` (`page` ≥ 1, default 1; `pageSize` 1–100, default 20). The
handler returns `PagedResult.of(items, query, total)`. The repository or queries class uses
`limit: pageSize, offset: offsetOf(query)`.

### 4.6 Health
`GET /health` is unversioned, public and raw: `200 { status: 'ok', db: 'up' }`, or
`503 { status: 'error', db: 'down' }`. It is served by `HealthController` →
`CheckHealthQuery` → `DATABASE_HEALTH`.

### 4.7 Request logging
`RequestLoggerMiddleware` logs `METHOD url status duration` through Nest's `Logger`.
**It never logs bodies, headers or tokens.**

---

## 5. Shared kernel (`src/shared`)

| File | Purpose |
| ---- | ------- |
| `utils/Uuid.ts` | `uuidv7()` (RFC 9562, time-ordered) and `isUuid()` |
| `utils/Pagination.ts` | `DEFAULT_PAGE`, `DEFAULT_PAGE_SIZE=20`, `MAX_PAGE_SIZE=100`, `PageMeta`, `PageRequest`, `PagedResult`, `offsetOf()` |
| `errors/AppError.ts` | `AppError` and its subclasses (§4.3), plus `ErrorDetail` |
| `domain/Guards.ts` | `requiredText`, `optionalText`, `oneOf`, … all throw `ValidationFailedError` for one field |
| `auth/Actor.ts` | the caller: `userId`, `organizationId`, `plane`, `permissions`, … (§8.7) |

Guard semantics:
- `requiredText(value, field, label, max)` trims the value. Empty gives `"<Label> is required."`;
  too long gives `"<Label> must be <max> characters or fewer."`.
- `optionalText(value, field, label, max)` returns `null` for `null`, `undefined` or blank;
  otherwise it applies `requiredText`.
- `oneOf(value, allowed, field, label)` throws `"<Label> must be one of: a, b."`.

`field` is the request property the frontend maps the error onto, for example `name` or
`superUser.email`.

---

## 6. Domain layer

### 6.1 `BaseModel.ts`
```ts
export abstract class BaseModel extends Model {
  @PrimaryKey
  @Default(uuidv7)
  @Column(DataType.UUID)
  id!: string;

  createdAt!: Date;   // created_at — stamped by Sequelize
  updatedAt!: Date;   // updated_at — stamped by Sequelize (also by Model.update)
}
```
Never set `id`, `createdAt` or `updatedAt` by hand.

### 6.2 `<Entity>Model.ts` — Sequelize persistence model
```ts
@Table({ tableName: 'projects', underscored: true, timestamps: true })
export class ProjectModel extends BaseModel {
  @ForeignKey(() => OrganizationModel)
  @Column({ type: DataType.UUID, allowNull: false })
  organizationId!: string;                 // organization_id

  @Column({ type: DataType.STRING(120), allowNull: false })
  name!: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  description!: string | null;

  @Column({ type: DataType.STRING(20), allowNull: false })
  status!: ProjectStatus;
}
```
Rules:
- Table names are **plural snake_case** (`projects`, `user_roles`). With `underscored: true`, TS
  attributes are camelCase and columns snake_case.
- The Model mirrors the migration exactly. The **migration is the source of truth** for
  constraints, indexes, defaults and FKs. Column lengths match the aggregate's `*_MAX_LENGTH`
  constants.
- Enumerations are `varchar` + `CHECK (… IN (…))` in SQL, typed as a string union in TS.
- No business logic in Models.
- `useDefineForClassFields` is `false` in `tsconfig.json`, so `!` fields never shadow Sequelize
  getters. Do not change it.

### 6.3 Join tables
Many-to-many tables (`user_roles`, `role_permissions`, `team_members`) have a **composite primary
key** and a small model that does **not** extend `BaseModel`:
```ts
@Table({ tableName: 'user_roles', underscored: true, timestamps: false })
export class UserRoleModel extends Model {
  @PrimaryKey @ForeignKey(() => UserModel) @Column(DataType.UUID) userId!: string;
  @PrimaryKey @ForeignKey(() => RoleModel) @Column(DataType.UUID) roleId!: string;
  @Column(DataType.UUID) assignedBy!: string | null;
  @Column(DataType.DATE) assignedAt!: Date;
}
```
A join table belongs to the aggregate that owns the relationship. The User aggregate carries
`roleIds` and its repository rewrites `user_roles` in the same transaction. A join table is never
an aggregate of its own.

### 6.4 `<Entity>.ts` — the domain aggregate
```ts
import { optionalText, oneOf, requiredText } from '@shared/domain/Guards';

const NAME_MAX_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 5000;
export const PROJECT_STATUSES = ['planning', 'active', 'completed', 'archived'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface ProjectProps {          // input for create()
  organizationId: string;
  name: string;
  description: string | null;
}

export class Project {
  private constructor(                    // private ctor: only create() / rehydrate()
    private readonly _id: string | null,
    private readonly _organizationId: string,
    private _name: string,
    private _description: string | null,
    private _status: ProjectStatus,
  ) {}

  // NEW aggregate: start empty, then run EVERY mutator so all rules apply.
  static create(props: ProjectProps): Project {
    const project = new Project(null, props.organizationId, '', null, 'planning');
    project.rename(props.name);
    project.describe(props.description);
    return project;
  }

  // FROM DB: trust stored data, no validation.
  static rehydrate(id: string, organizationId: string, name: string,
                   description: string | null, status: ProjectStatus): Project {
    return new Project(id, organizationId, name, description, status);
  }

  get id(): string | null { return this._id; }
  get organizationId(): string { return this._organizationId; }
  get name(): string { return this._name; }
  get description(): string | null { return this._description; }
  get status(): ProjectStatus { return this._status; }

  // Intention-revealing behaviour methods: the ONLY way to change state.
  rename(name: string): void {
    this._name = requiredText(name, 'name', 'Project name', NAME_MAX_LENGTH);
  }
  describe(description: string | null): void {
    this._description = optionalText(description, 'description', 'Description', DESCRIPTION_MAX_LENGTH);
  }
  changeStatus(status: string): void {
    this._status = oneOf(status, PROJECT_STATUSES, 'status', 'Status');
  }
}
```
Aggregate rules:
- No Nest or Sequelize imports. Pure TypeScript plus `@shared`.
- Private fields are prefixed `_`, read through getters, and changed only through verbs.
- `id` is `null` until saved. The repository returns the rehydrated aggregate with its id.
- Rules needing the database (uniqueness, parent exists, has children) are **not** in the
  aggregate. The handler checks them through the repository.
- Status vocabularies are the frontend's (for example `active | suspended`). There is no
  project-wide status enum.

---

## 7. Infrastructure layer

### 7.1 `DatabaseModule.ts` (global, one per service)
It connects with `uri: DATABASE_URL`, `autoLoadModels: true`, **`synchronize: false`** and
`logging: false`. It provides and exports `UNIT_OF_WORK` (`SequelizeUnitOfWork`) and
`DATABASE_HEALTH`. Models are registered by each `<Entity>PersistenceModule` through
`SequelizeModule.forFeature([...])`.

### 7.2 Migrations and seeds
- `migrations/NNNN_<what>.sql` are forward-only and applied in file-name order by
  `migrator.ts` (`npm run db:migrate`). Each file runs in its own transaction and is recorded in
  `schema_migrations`.
  **Never edit a migration that has been merged.** Add a new one instead.
- Every migration defines the full truth of what it adds:
  - `uuid` primary keys (values come from `uuidv7()` in the app);
  - `created_at` / `updated_at timestamptz NOT NULL DEFAULT now()`;
  - FKs with `ON DELETE RESTRICT` unless stated otherwise;
  - an index on every FK and on frequent filters;
  - `CHECK` constraints for enumerations;
  - unique indexes for uniqueness, case-insensitive via `citext` or `lower(...)`.
- Every tenant-owned table has `organization_id uuid NOT NULL REFERENCES organizations(id)` and an
  index on it.
- `seeds/` holds idempotent seed functions (`ON CONFLICT DO NOTHING` / upserts), listed in order in
  `seeds/index.ts` and run by `npm run db:seed`. Seeds hold reference data (permission catalogue,
  the platform super user from env), never test fixtures.

### 7.3 Transactions (`IUnitOfWork`)
```ts
export type Tx = object;                         // opaque: application never sees Sequelize
export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');
export interface IUnitOfWork {
  run<T>(work: (tx: Tx) => Promise<T>): Promise<T>;   // commit on resolve, roll back on throw
}
```
Every repository write method takes an optional last parameter `tx?: Tx`, and passes
`{ transaction: tx as Transaction }` to Sequelize. A handler that writes more than one table:
```ts
return this.unitOfWork.run(async (tx) => {
  const saved = await this.roleRepository.save(role, tx);
  await this.auditLog.record(entry, tx);
  return saved;
});
```

### 7.4 Repository (WRITE side)
```ts
// repositories/abstraction/IProjectRepository.ts
export const PROJECT_REPOSITORY = Symbol('PROJECT_REPOSITORY');

export interface IProjectRepository {
  save(project: Project, tx?: Tx): Promise<Project>;              // insert; returns it with its id
  update(project: Project, tx?: Tx): Promise<void>;
  findById(organizationId: string, id: string): Promise<Project | null>;
  nameExists(organizationId: string, name: string, exceptId?: string): Promise<boolean>;
}
```
```ts
// repositories/ProjectRepository.ts
@Injectable()
export class ProjectRepository implements IProjectRepository {
  constructor(@InjectModel(ProjectModel) private readonly projectModel: typeof ProjectModel) {}

  async save(project: Project, tx?: Tx): Promise<Project> {
    const row = await this.projectModel.create(
      { organizationId: project.organizationId, name: project.name,
        description: project.description, status: project.status },
      { transaction: tx as Transaction },
    );
    return this.toDomain(row);
  }

  async findById(organizationId: string, id: string): Promise<Project | null> {
    const row = await this.projectModel.findOne({ where: { organizationId, id } });
    return row ? this.toDomain(row) : null;
  }

  private toDomain(row: ProjectModel): Project {
    return Project.rehydrate(row.id, row.organizationId, row.name, row.description, row.status);
  }
}
```

### 7.5 Queries (READ side)
```ts
// queries/abstraction/IProjectQueries.ts
export const PROJECT_QUERIES = Symbol('PROJECT_QUERIES');

export interface ProjectReadModel {      // exactly the frontend's shape; dates as ISO strings
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectListFilter extends PageRequest {
  organizationId: string;
  search?: string;
  status?: string;
}

export interface IProjectQueries {
  findList(filter: ProjectListFilter): Promise<{ rows: ProjectReadModel[]; total: number }>;
  findById(organizationId: string, id: string): Promise<ProjectReadModel | null>;
}
```
List conventions:
- `iLike` search over text columns, combined with `Op.and`.
- Order by the contract's default (usually newest first: `created_at DESC, id DESC`).
- `limit` / `offset` from the page.
- Read models never contain secrets (password hashes, token hashes).

### 7.6 `<Entity>PersistenceModule.ts`
```ts
@Module({
  imports: [SequelizeModule.forFeature([ProjectModel, UnitModel])],
  providers: [
    { provide: PROJECT_REPOSITORY, useClass: ProjectRepository },
    { provide: PROJECT_QUERIES, useClass: ProjectQueries },
  ],
  exports: [PROJECT_REPOSITORY, PROJECT_QUERIES],
})
export class ProjectPersistenceModule {}
```

---

## 8. Application layer — vertical slices

One **module folder per aggregate** and one **feature folder per use case**. Every feature is
self-contained: its message, handler, request DTO and response DTO live together.

```
application/modules/project/
├── ProjectModule.ts
└── features/
    ├── createproject/   CreateProjectCommand · CreateProjectCommandHandler · CreateProjectRequest · CreateProjectResponse
    ├── updateproject/   UpdateProjectCommand · UpdateProjectCommandHandler · UpdateProjectRequest
    ├── getproject/      GetProjectQuery · GetProjectQueryHandler · GetProjectResponse
    └── getprojects/     GetProjectsQuery · GetProjectsQueryHandler · GetProjectsRequest
```

### 8.1 `<Entity>Module.ts`
```ts
@Module({
  imports: [CqrsModule, ProjectPersistenceModule],
  providers: [CreateProjectCommandHandler, UpdateProjectCommandHandler,
              GetProjectQueryHandler, GetProjectsQueryHandler],
})
export class ProjectModule {}
```

### 8.2 Command / Query (immutable messages)
The caller always comes first:
```ts
export class CreateProjectCommand implements ICommand {
  constructor(
    public readonly actor: Actor,
    public readonly name: string,
    public readonly description: string | null,
  ) {}
}
```
For **PATCH**, every field is `T | undefined`, or `T | null | undefined` if it can be cleared.
`undefined` means "leave unchanged" and `null` means "clear".

### 8.3 Request DTO (validation + Swagger)
```ts
export class CreateProjectRequest {
  @ApiProperty({ example: 'Palm Heights', minLength: 2, maxLength: 120 })
  @IsString() @Length(2, 120)
  name!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 5000 })
  @IsOptional() @IsString() @MaxLength(5000)
  description?: string | null;
}
```
- Property names and constraints come from the frontend contract and its request types.
- List filters are a `Get<Entities>Request extends PageQuery` bound with `@Query()`.

### 8.4 Command handlers
```ts
@CommandHandler(CreateProjectCommand)
export class CreateProjectCommandHandler
  implements ICommandHandler<CreateProjectCommand, GetProjectResponse> {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projectRepository: IProjectRepository,
    @Inject(PROJECT_QUERIES) private readonly projectQueries: IProjectQueries,
  ) {}

  async execute(command: CreateProjectCommand): Promise<GetProjectResponse> {
    const organizationId = requireTenant(command.actor);            // 1. scope
    requirePermission(command.actor, 'projects.create');            // 2. permission
    if (await this.projectRepository.nameExists(organizationId, command.name)) {
      throw new ConflictError('PROJECT_NAME_CONFLICT', 'A project with this name already exists.');
    }                                                               // 3. DB rules
    const project = Project.create({ organizationId, name: command.name,
                                     description: command.description });  // 4. invariants
    const saved = await this.projectRepository.save(project);       // 5. persist
    return GetProjectResponse.from(
      (await this.projectQueries.findById(organizationId, saved.id as string))!,
    );                                                              // 6. same shape as GET
  }
}
```
A command handler may read its result back through the Queries class, so that a create or update
returns exactly the shape of the matching GET. Query handlers never touch a repository or an
aggregate.

### 8.5 Query handlers
```ts
@QueryHandler(GetProjectsQuery)
export class GetProjectsQueryHandler implements IQueryHandler<GetProjectsQuery, PagedResult<ProjectReadModel>> {
  constructor(@Inject(PROJECT_QUERIES) private readonly projectQueries: IProjectQueries) {}

  async execute(query: GetProjectsQuery): Promise<PagedResult<ProjectReadModel>> {
    const organizationId = requireTenant(query.actor);
    requirePermission(query.actor, 'projects.view');
    const { rows, total } = await this.projectQueries.findList({ ...query.filter, organizationId });
    return PagedResult.of(rows, query.filter, total);
  }
}
```

### 8.6 Response DTOs
Each slice owns its response, and every property has `@ApiProperty`. Responses built from a read
model use `static from(rm) { return Object.assign(new XResponse(), rm); }`. A slice may reuse a
sibling slice's response (`../getproject/GetProjectResponse`). Field names, nesting and nullability
match the frontend contract exactly.

### 8.7 The caller (`Actor`) and tenant scoping
`@shared/auth/Actor.ts` holds a plain interface: who is calling, their plane
(`platform | tenant`), their `organizationId` (`null` on the platform plane) and their effective
permissions. The auth change resolves it from the access token. Controllers receive it with
`@CurrentActor()` and pass it as the first argument of every Command or Query.

Rules:
- A tenant handler derives `organizationId` **only** from the actor, never from the request body or
  path.
- Every tenant repository or queries method takes `organizationId` and filters on it. A row of
  another tenant is reported as **404**, never 403, so ids cannot be probed.
- Permission and plane checks run in the handler (or a guard), before any data is touched. The UI
  hiding a button is never the check.

---

## 9. API layer — controllers

One controller per aggregate in `src/api/controllers/<Entity>Controller.ts`. It injects **only**
`CommandBus` and `QueryBus`.

```ts
@ApiTags(SwaggerTag.Projects)
@ApiBearerAuth()
@Controller(ApiRoute.Projects)                       // 'projects'
export class ProjectController {
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

  @Post()
  @ApiOperation({ summary: 'Create a project' })
  @ApiResponse({ status: 201, type: GetProjectResponse })
  @ApiResponse({ status: 409, description: 'PROJECT_NAME_CONFLICT' })
  @ApiResponse({ status: 422, description: 'VALIDATION_FAILED' })
  create(@CurrentActor() actor: Actor, @Body() request: CreateProjectRequest): Promise<GetProjectResponse> {
    return this.commandBus.execute(
      new CreateProjectCommand(actor, request.name, request.description ?? null),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List projects (search, filter, paginate)' })
  findAll(@CurrentActor() actor: Actor, @Query() request: GetProjectsRequest): Promise<PagedResult<ProjectReadModel>> {
    return this.queryBus.execute(new GetProjectsQuery(actor, request));
  }

  @Get(':id')
  findOne(@CurrentActor() actor: Actor, @Param('id', ParseUuidPipe) id: string): Promise<GetProjectResponse> {
    return this.queryBus.execute(new GetProjectQuery(actor, id));
  }
}
```
Controller conventions:
- Routes, methods, status codes and bodies follow the frontend contract (`/api/v1/<route>`). For
  example, actions are `POST /<route>/:id/<verb>` (`/suspend`), and DELETE returns `data: null`.
- `?? null` for optional create fields; pass raw (possibly `undefined`) values for PATCH.
- Ids go through `ParseUuidPipe`, and lists through a `PageQuery`-based Request.
- Set non-default statuses with `@HttpCode(200)` on POST actions that are not creates.
- Every endpoint has `@ApiOperation` and an `@ApiResponse` for each status it can return.

---

## 10. Naming conventions

| Thing | Convention | Example |
| ----- | ---------- | ------- |
| Files / classes | PascalCase, one class per file | `ProjectRepository.ts` |
| Module folder | lowercase, no separators | `modules/platformadmin/` |
| Feature folder | lowercase verb+noun, no separators | `features/suspenddeveloper/` |
| Aggregate folder | `<Entity>Aggregate` | `ProjectAggregate/` |
| Domain class / model | `<Entity>` / `<Entity>Model` | `Project`, `ProjectModel` |
| DI token | `SCREAMING_SNAKE` `Symbol` | `PROJECT_REPOSITORY` |
| Interfaces | `I` prefix (abstractions only) | `IProjectRepository` |
| Read model / filter | `<Entity>ReadModel`, `<Entity>ListFilter` | |
| Route | the contract's path (kebab-case, plural) | `projects`, `platform/developers` |
| Table / column | snake_case, plural tables | `projects.organization_id` |
| Migration file | `NNNN_<what>.sql` | `0004_projects_and_units.sql` |
| Error code | SCREAMING_SNAKE, from the contract | `PROJECT_NAME_CONFLICT` |
| Permission code | `module.action` | `projects.edit` |

---

## 11. Recipe — adding a module (checklist)

For an aggregate `Foo`:

1. **Migration.** Write `migrations/NNNN_foo.sql`: the table, constraints, indexes, FKs and
   `organization_id` if it is tenant-owned. Run `npm run db:migrate`.
2. **Domain.**
   - [ ] `domain/aggregates/FooAggregate/FooModel.ts`, mirroring the migration.
   - [ ] `domain/aggregates/FooAggregate/Foo.ts`: `FooProps`, private ctor, `create`,
     `rehydrate`, getters and guarded mutators.
3. **Infrastructure.**
   - [ ] `repositories/abstraction/IFooRepository.ts` (+ `FOO_REPOSITORY`) and `repositories/FooRepository.ts`.
   - [ ] `queries/abstraction/IFooQueries.ts` (+ `FOO_QUERIES`, `FooReadModel`, `FooListFilter`) and `queries/FooQueries.ts`.
   - [ ] `persistence/FooPersistenceModule.ts`: `forFeature` with every model used, and bind and
     export the tokens.
4. **Application.** In `application/modules/foo/`, one feature folder per endpoint, plus
   `FooModule.ts`.
5. **API.**
   - [ ] `ApiRoute.Foo` / `SwaggerTag.Foo`.
   - [ ] `controllers/FooController.ts`.
   - [ ] Register `FooModule` and `FooController` in `ApiModule`.
6. **Seeds.** Add any new permission codes to the catalogue seed.
7. **Tests (§17.3).**
   - [ ] Aggregate spec.
   - [ ] Handler specs.
   - [ ] `FooRepository.int-spec.ts` / `FooQueries.int-spec.ts`.
   - [ ] `test/foo.e2e-spec.ts` with every endpoint and error path.
8. **Verify.** The §18.4 pre-flight is green, and the frontend screens work against the API.

---

## 12. Request lifecycle (end-to-end)

```
PATCH /api/v1/projects/0192…  { "name": "  " }     Authorization: Bearer <access>
  │
  ├─ RequestLoggerMiddleware (logs on finish)
  ├─ Auth guard → Actor { userId, organizationId, plane: 'tenant', permissions }
  ├─ ValidationPipe → UpdateProjectRequest (shape ok: name is a string)
  ├─ ProjectController.update → new UpdateProjectCommand(actor, id, '  ', undefined, …)
  ├─ CommandBus → UpdateProjectCommandHandler.execute
  │     ├─ requireTenant / requirePermission('projects.edit')
  │     ├─ projectRepository.findById(organizationId, id) → Project.rehydrate(...)
  │     ├─ project.rename('  ') → requiredText → ValidationFailedError(name: 'Project name is required.')
  │
  └─ AllExceptionsFilter → 422 { success: false, error: { code: 'VALIDATION_FAILED',
                                  message: 'Project name is required.', details: [{ field: 'name', … }] } }
```

---

## 13. Environment & local DB

`.env.example`:
```
PORT=3000
DATABASE_URL=postgres://postgres:postgres@localhost:5436/crm_developer
DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5436/crm_developer_test
```
`docker-compose.yml` runs one `postgres:16-alpine` (healthcheck, named volume). An init script
creates `crm_developer_test`.

Local start:
```
docker compose up -d && npm install && npm run db:migrate && npm run db:seed && npm run start:dev
```
The frontend dev server proxies `/api/v1/*` to `API_URL=http://localhost:3000`.

---

## 14. Do / Don't summary

**Do**
- Keep each use case in its own feature folder.
- Validate request shape with DTO decorators, and business invariants in the aggregate.
- Split writes (Repository + aggregate) from reads (Queries + ReadModel).
- Scope every tenant read and write by the actor's `organizationId`.
- Inject by `Symbol` token against an interface, and use `IUnitOfWork` for multi-table writes.
- Throw `AppError` subclasses with the contract's code, and let the filter render them.
- Write a migration for every schema change, and document every endpoint in Swagger.

**Don't**
- Don't return Sequelize models from repositories, queries or controllers.
- Don't put logic in controllers or Models.
- Don't call one module's handlers from another module. Add the method you need to your own
  repository or queries.
- Don't set `id` / `createdAt` / `updatedAt` by hand, and don't enable `synchronize`.
- Don't trust ids, permissions or organization ids sent by the client.
- Don't log or return secrets (passwords, tokens, hashes).

---

## 15. Coding practices

These apply to every file in `src/`, `seeds/` and `test/`.

### 15.1 TypeScript
- `tsconfig.json` uses `"strict": true`. Never weaken it per file.
- **No `any`.** Use `unknown` and narrow it. Each `as` cast needs a reason. The allowed exceptions
  are `tx as Transaction`, `saved.id as string` after a save, and Sequelize `where` typing.
- Use the `!` definite-assignment operator **only** on Sequelize Model columns and Request/Response
  DTO properties. Never use the `x!` non-null assertion on values, except right after a read that
  the line above guarantees.
- Give every exported function and public method an explicit return type.
- Mark constructor-injected dependencies and all Command/Query fields `readonly`.
- Use named exports only. No `export default`, except the jest global setup, and no barrel
  `index.ts` files (except `seeds/index.ts`).
- Prefer `const`, never use `var`, and always compare with `===`.
- Use `async/await` only and never chain `.then()`. Don't leave promises floating; the only
  exception is `void bootstrap()`.

### 15.2 `null` vs `undefined`
| Value | Meaning | Where it may appear |
| ----- | ------- | ------------------- |
| `null` | "no value" (SQL `NULL`) | aggregates, models, read models, responses |
| `undefined` | "not provided / leave unchanged" | PATCH commands and requests, optional query params |

- Optional create fields are normalised in the controller with `?? null`.
- Aggregates and read models never hold `undefined`.
- Never use `null` to mean "leave unchanged".

### 15.3 Naming, size and readability
- Name methods with verbs (`rename`, `suspend`, `findList`). Booleans start with `is`, `has` or
  `exists`.
- No magic numbers or strings. Put them in `SCREAMING_SNAKE` constants at the top of the file, or
  in shared constants (`MAX_PAGE_SIZE`, `ApiRoute`, permission codes).
- Guidelines: a function has **≤ 30 lines**, nesting is **≤ 3 levels** and a file has
  **≤ 200 lines**. Above that, extract a private method. Exceptions are controllers and aggregates
  with many fields.
- Prefer guard clauses and early returns to `else` chains.
- Put one class in each file, and name the file after the class.

### 15.4 Imports
Import order, with one blank line between groups:
1. Node built-ins (`crypto`)
2. `@nestjs/*`
3. Other packages (`sequelize`, `class-validator`)
4. Path aliases, in layer order: `@shared`, `@domain`, `@infrastructure`, `@application`, `@api`
5. Relative imports (`./`, or `../` for a sibling slice or `api/` sub-folder)

Never use `../../` inside `src/`.

### 15.5 Errors
- Throw only `AppError` subclasses (§4.3), with the exact code the contract uses.
- Messages are short, user-facing sentences ending in a full stop:
  `"A project with this name already exists."`.
- Never swallow an error: no empty `catch` blocks and no `catch` that only logs. Handlers don't use
  `try/catch` unless they translate an error.
- Messages never leak internals: SQL, stack traces, column names, or whether another tenant's id
  exists.

### 15.6 Persistence
- Check existence with `count(...) > 0`, not `findOne`.
- Read models expose dates as ISO strings (`toISOString()`), and `date` columns as `YYYY-MM-DD`.
- Lists always have `order`, `limit` and `offset`.
- **No queries inside loops.** Load related data with `include` or a single `IN` query.
- Never build raw SQL by string concatenation. When raw SQL is needed (stats, aggregates), use
  `replacements`.
- Multi-table writes go through `IUnitOfWork`.

### 15.7 Comments, logging and dead code
- Comments explain **why**, not what. Don't leave commented-out code.
- A `TODO` must reference an OpenSpec change: `// TODO(add-org-hierarchy): …`.
- No `console.*`. Log through Nest's `Logger`, and never log secrets or bodies.
- Remove unused imports, variables, parameters and files.

### 15.8 Lint and format
- `npm run lint` must report **0 errors and 0 warnings**, and `npm run format:check` must pass.
- Prettier is the formatter: `singleQuote`, `trailingComma: all`, `printWidth: 100`.
- An `eslint-disable` comment must be on a single line and include a reason:
  `// eslint-disable-next-line <rule> -- <reason>`.

### 15.9 Security
- Never put secrets in code, tests or fixtures. Configuration comes from `ConfigService` and `.env`,
  and only `.env.example` is committed. This repo is **public**.
- Passwords and refresh tokens are stored only as hashes. Responses and logs never contain them.
- Ids from the client are only lookup keys. Ownership and tenant are always checked against the
  actor.
- Every protected endpoint is authenticated by default. Public endpoints opt out explicitly.

---

## 16. Rules and boundaries

### 16.1 Hard rules (blockers)
Breaking any hard rule blocks the PR, whatever its score (§19.1).

| ID  | Rule | Automated check |
| --- | ---- | --------------- |
| R1  | Runtime `dependencies` come only from the allowlist in `scripts/check-boundaries.sh` | yes |
| R2  | `shared/` imports nothing outside `shared/`: no Nest, no Sequelize, no other layer | yes |
| R3  | Domain aggregates (`<Entity>.ts`) import only `@shared/*` | yes |
| R4  | `application/` never imports concrete repositories or queries, Models or `sequelize` | yes |
| R5  | `api/` never imports `@infrastructure`, `@domain` or `sequelize` | yes |
| R6  | No Nest `HttpException` (or subclasses) is thrown by our code | yes |
| R7  | Repositories never set `createdAt` / `updatedAt` | yes |
| R8  | `synchronize` is never enabled, and `sync()` is never called | yes |
| R9  | Handlers never inject `CommandBus` / `QueryBus` (no cross-module handler calls) | yes |
| R10 | No raw SQL built by string interpolation (`` query(`…${…}`) ``) | yes |
| R11 | No `console.*` in `src/` or `seeds/` | yes |
| R12 | No `.env` file or secret is committed | yes |
| R13 | Repositories, queries, handlers and controllers never return Sequelize Models | review |
| R14 | No business rules in controllers, Models or DTOs | review |
| R15 | Every tenant read or write is scoped by the actor's `organizationId` | review + tests |

`scripts/check-boundaries.sh` (`npm run check:boundaries`) runs every automated check. Each check
must print nothing.

### 16.2 Layer boundaries
§3 is the source of truth.

### 16.3 Change boundaries (scope)
- **One PR covers one OpenSpec change.** Don't add "while I'm here" edits.
- **The architecture is frozen inside feature PRs.** Changing a pattern in this guide needs its own
  OpenSpec change (like `platform-foundation`), before any code uses it.
- **The frontend contract is the API.** A response field, code or route that differs from
  `api-contract-v1.md` or the frontend's MSW handlers is a bug. The only exception is a change
  whose spec says so and updates the frontend in the same change.
- **Database.** Schema changes only through new migration files. A merged migration is never edited.

---

## 17. Testing

### 17.1 Tooling
- `jest` + `ts-jest`, `@nestjs/testing`, and `supertest` for e2e. These are devDependencies only.
- `jest.config.js` (unit), `jest.int.config.js`, `jest.e2e.config.js` and `jest.cov.config.js`
  share the alias `moduleNameMapper`. Integration and e2e use `test/setup/global-setup.ts`, which
  **refuses any database not named `*_test`** and runs the migrator, and `test/setup/test-env.ts`,
  which points `DATABASE_URL` at `DATABASE_URL_TEST`.
- Coverage (`npm run test:cov`, unit + integration + e2e) must stay ≥ 85% lines, 80% branches,
  85% functions and 85% statements. `*Module.ts`, `*Model.ts`, `*.cli.ts` and `main.ts` are excluded.

### 17.2 Test types
| Type | What it tests | File | Location | Database | Command |
| ---- | ------------- | ---- | -------- | -------- | ------- |
| Unit | aggregates, guards, utils, handlers, filters, pipes | `<File>.spec.ts` | next to the source | none | `npm test` |
| Integration | repositories, queries, migrator, seeds | `<File>.int-spec.ts` | next to the source | `crm_developer_test` | `npm run test:int` |
| E2E | full HTTP flow through `AppModule` + `configureApp` | `<feature>.e2e-spec.ts` | `test/` | `crm_developer_test` | `npm run test:e2e` |

Never use SQLite or an in-memory database: `iLike`, `citext`, `CHECK` and UUID behave differently.

### 17.3 What every module must test
| Target | Required cases |
| ------ | -------------- |
| Aggregate | `create` defaults; every mutator with a valid value, trimming, blank → `ValidationFailedError` with the field and exact message, max passes and max+1 fails; `rehydrate` does not validate |
| Handlers | happy path; every error code the contract lists for that endpoint; permission denied; another tenant's id → 404 |
| Repository / Queries (int) | save returns the id; update persists; uniqueness checks; filters, search, pagination, order; ISO dates; tenant isolation |
| E2E | every endpoint the frontend calls, with its success status and body shape **and** every 4xx path, including 401 without a token and 403 without permission |

### 17.4 Conventions
- Structure: `describe('<Class>')` → `describe('<method>')` → `it('should <outcome> when <condition>')`.
- Arrange / Act / Assert, with **one behaviour per test**. Tests don't depend on order or on each other.
- Construct handlers directly with `new`, passing `jest.Mocked<IFooRepository>`. Use
  `Test.createTestingModule` only for integration and e2e.
- **Never mock aggregates, Guards or shared utilities.**
- Assert the **error class and the exact code / message**.
- Integration and e2e tests clean up the rows they create (truncate the module's tables in
  `beforeEach`, never `schema_migrations`), and close the app or connection in `afterAll`.
- No `sleep` and no dependence on the wall clock. Use `jest.useFakeTimers()` or relative assertions.
- No `.only`, and no `.skip` without a TODO that references a change.

### 17.5 Required npm scripts
`build`, `start`, `start:dev`, `lint`, `format`, `format:check`, `db:migrate`, `db:seed`, `test`,
`test:int`, `test:e2e`, `test:cov` and `check:boundaries`. See `package.json`.

---

## 18. Pull requests

### 18.1 Branches
`<type>/<name>`, where `<name>` is the OpenSpec change name: `feat/platform-foundation`,
`feat/auth-sessions`, `fix/…`, `docs/…`, `chore/…`. The base is always `development`.

### 18.2 Commits
- Use Conventional Commits: `type(scope): subject`. The scope is the module or layer.
- Write the subject in the imperative, lowercase, with no trailing period and **≤ 72 characters**.
- PRs are **squash-merged**, so the PR title becomes the final commit message.

### 18.3 Size and scope
One OpenSpec change per PR. Prefer changes of one or two modules. Split larger work by module,
never by layer, so that every PR is a working vertical slice.

### 18.4 Pre-flight (run before opening or updating a PR)
```bash
npm run build
npm run lint
npm run format:check
npm run check:boundaries
npm test
npm run test:int
npm run test:e2e
npm run test:cov
openspec validate <change-name> --strict
```

### 18.5 PR description
~~~markdown
## What
<summary of the behaviour added/changed>

## Why
OpenSpec change: `openspec/changes/<change-name>/` (archived to `openspec/changes/archive/…`)

## Frontend screens served
<screens / contract sections>

## Endpoints
| Method | Path | Success | Errors |
| ------ | ---- | ------- | ------ |

## DB changes
Migrations: `migrations/NNNN_….sql` — <tables>

## Tests
Unit / integration / e2e counts, coverage.

## Scorecard (§19)
<paste scorecard>
~~~

### 18.6 Review and merge
1. The author opens the PR with the pre-flight green and a self-score.
2. The reviewer, or the author for solo work, checks in this order: hard rules → contract fidelity →
   tenant scoping → tests → everything else, then fills in the scorecard.
3. The PR is squash-merged into `development` when its grade allows it (§19.4), the branch is
   deleted, and the change is archived (`openspec archive`) on the branch before the merge.

---

## 19. Scoring system

Every PR gets a score out of **100**. Scoring happens in two stages: a **gate**, then a
**weighted rubric**.

### 19.1 Gate (pass/fail)
If any gate item fails, **score = 0** and the PR is blocked.

| ID | Gate |
| -- | ---- |
| G1 | `npm run build` passes |
| G2 | `npm run lint` passes with 0 errors and 0 warnings, and `format:check` passes |
| G3 | `npm test`, `test:int` and `test:e2e` are all green |
| G4 | `npm run check:boundaries` is clean (R1–R12) |
| G5 | No R13–R15 violation found in review |

### 19.2 Rubric (100 points)
Score each criterion **full**, **half** (1–2 isolated slips) or **zero**.

**A. Architecture conformance — 25**
| # | Criterion | Pts |
| - | --------- | --- |
| A1 | Folders, file names and class names follow §2 and §10 | 5 |
| A2 | Aggregate pattern exact (§6.4) | 6 |
| A3 | Write/read split, with Symbol-injected abstractions (§7) | 5 |
| A4 | Thin controllers that only map input and pass the actor (§9) | 4 |
| A5 | Migration, model, persistence module and `ApiModule` registrations are complete (§11) | 3 |
| A6 | Migration constraints and indexes match the model and the aggregate limits | 2 |

**B. Contract & boundaries — 15**
| # | Criterion | Pts |
| - | --------- | --- |
| B1 | Routes, bodies, status codes and error codes match the frontend contract | 5 |
| B2 | Tenant scoping and permission checks on every endpoint | 4 |
| B3 | Scope: only the change's own modules plus registration points | 3 |
| B4 | Swagger complete | 3 |

**C. Coding practices — 20**
| # | Criterion | Pts |
| - | --------- | --- |
| C1 | Type safety (§15.1) | 4 |
| C2 | Naming, size, readability, simplicity (simple-code skill) | 4 |
| C3 | Correct `null` / `undefined` semantics (§15.2) | 3 |
| C4 | Persistence practices: transactions, no N+1, ISO dates (§15.6) | 3 |
| C5 | Import order and alias rules (§15.4) | 2 |
| C6 | No dead code, stray TODOs or console calls (§15.7) | 2 |
| C7 | Security practices (§15.9) | 2 |

**D. Testing — 25**
| # | Criterion | Pts |
| - | --------- | --- |
| D1 | Aggregate tests cover every mutator, including boundaries | 5 |
| D2 | Handler tests cover the happy path and every error path | 6 |
| D3 | Integration tests for repositories and queries, including tenant isolation | 5 |
| D4 | E2E covers every endpoint and every 4xx path | 5 |
| D5 | Coverage thresholds met | 2 |
| D6 | Test quality (§17.4) | 2 |

**E. PR quality — 15**
| # | Criterion | Pts |
| - | --------- | --- |
| E1 | Description complete per §18.5, including the OpenSpec link | 4 |
| E2 | Single concern (§18.3) | 3 |
| E3 | Branch, title and commits follow the conventions | 3 |
| E4 | OpenSpec artifacts (proposal, specs, design, tasks) complete and archived | 3 |
| E5 | Self-score included and honest | 2 |

### 19.3 Category floors
Each category must score **at least 50% of its maximum**. A PR that misses any floor gets grade
**D**.

### 19.4 Grades
| Score | Grade | Outcome |
| ----- | ----- | ------- |
| 90–100 | **A** | Merge |
| 80–89.5 | **B** | Merge after fixing the noted minors |
| 70–79.5 | **C** | Changes requested; re-score after the fixes |
| < 70, or a missed floor | **D** | Rejected; rework |
| Gate failed | **0** | Blocked |

### 19.5 Scorecard
```markdown
### Scorecard — <PR title>
Gate: G1 ✅ G2 ✅ G3 ✅ G4 ✅ G5 ✅

| Category | Score | Notes |
| -------- | ----- | ----- |
| A. Architecture (25)        |  |  |
| B. Contract & boundaries (15) |  |  |
| C. Coding (20)              |  |  |
| D. Testing (25)             |  |  |
| E. PR quality (15)          |  |  |
| **Total (100)**             |  | Grade: |
```
