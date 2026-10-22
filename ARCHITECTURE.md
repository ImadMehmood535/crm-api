# CRM Developer API — Architecture Guide

> Source of truth: this architecture is extracted 1:1 from
> `invespy-v2-feeds-microservice`. Every new module in `crm-developer-api`
> must follow these rules exactly.
>
> **Style:** NestJS 11 · DDD (aggregates + guards) · CQRS (`@nestjs/cqrs`) ·
> Vertical Slice (one folder per feature) · Sequelize (`sequelize-typescript`) on PostgreSQL.
>
> **No third-party services.** No S3, no queues, no email/SMS providers, no
> external auth, no caches. The only runtime dependencies are NestJS, Sequelize
> and Postgres. Anything else (UUIDs, slugs, pagination, audit) is done in-house
> with Node built-ins (`crypto.randomUUID`) or shared utilities.
>
> **Sections 1–14** define the architecture. **Sections 15–19** define coding
> practices, rules & boundaries, testing, the PR process and the PR scoring
> system. All of them are binding.

---

## 1. Tech stack

| Concern            | Choice                                                         |
| ------------------ | -------------------------------------------------------------- |
| Framework          | `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`   |
| CQRS               | `@nestjs/cqrs` (`CommandBus`, `QueryBus`)                      |
| Config             | `@nestjs/config` (`ConfigModule.forRoot({ isGlobal: true })`)  |
| ORM                | `@nestjs/sequelize`, `sequelize`, `sequelize-typescript`       |
| DB driver          | `pg`, `pg-hstore` (PostgreSQL 16 via docker-compose)           |
| API docs           | `@nestjs/swagger` (served at `/docs`)                          |
| Path aliases       | `tsconfig.json` `paths` + `tsc-alias` at build time            |
| Tests              | `jest` + `ts-jest` (`*.spec.ts` inside `src`)                  |
| Lint / format      | `eslint` + `prettier` (`singleQuote`, `trailingComma: all`)    |

`package.json` dependencies (runtime) — nothing beyond this list:

```json
"@nestjs/common", "@nestjs/config", "@nestjs/core", "@nestjs/cqrs",
"@nestjs/platform-express", "@nestjs/sequelize", "@nestjs/swagger",
"pg", "pg-hstore", "reflect-metadata", "rxjs", "sequelize", "sequelize-typescript"
```

---

## 2. Top-level layout

```
crm-developer-api/
├── .env.example
├── docker-compose.yml          # postgres:16-alpine only
├── nest-cli.json
├── package.json
├── tsconfig.json / tsconfig.build.json
└── src/
    ├── main.ts                 # bootstrap + Swagger
    ├── app.module.ts           # ConfigModule + DatabaseModule + ApiModule
    │
    ├── api/                    # HTTP edge (thin)
    │   ├── ApiModule.ts
    │   ├── common/ApiConstants.ts
    │   ├── controllers/<Entity>Controller.ts
    │   ├── filters/DomainExceptionFilter.ts
    │   └── middleware/RequestLoggerMiddleware.ts
    │
    ├── application/            # vertical slices (CQRS)
    │   ├── common/PaginationMeta.ts
    │   └── modules/<entity>/
    │       ├── <Entity>Module.ts
    │       └── features/<featurename>/
    │           ├── <Feature>Command.ts | <Feature>Query.ts
    │           ├── <Feature>CommandHandler.ts | <Feature>QueryHandler.ts
    │           ├── <Feature>Request.ts      (commands with a body only)
    │           └── <Feature>Response.ts
    │
    ├── domain/                 # pure business model
    │   ├── aggregates/
    │   │   ├── BaseModel.ts
    │   │   └── <Entity>Aggregate/
    │   │       ├── <Entity>.ts          # domain aggregate (rules)
    │   │       └── <Entity>Model.ts     # Sequelize table model
    │   └── common/TableNames.ts
    │
    ├── infrastructure/         # persistence implementations
    │   ├── persistence/
    │   │   ├── DatabaseModule.ts
    │   │   ├── <Entity>PersistenceModule.ts
    │   │   └── hooks/AuditHook.ts
    │   ├── repositories/       # WRITE side (returns domain aggregates)
    │   │   ├── abstraction/I<Entity>Repository.ts
    │   │   └── <Entity>Repository.ts
    │   └── queries/            # READ side (returns plain read models)
    │       ├── abstraction/I<Entity>Queries.ts
    │       └── <Entity>Queries.ts
    │
    └── shared/                 # framework-free helpers
        ├── audit/AuditableFields.ts
        ├── domain/Guards.ts
        ├── enums/EntityStatus.ts
        ├── errors/{DomainError,NotFoundError,ConflictError}.ts
        └── utils/{Pagination,Slug}.ts
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

Use aliases for cross-layer imports; use relative `./` imports only **inside the same slice folder**.

---

## 3. Layers and dependency rules

```
         HTTP
          │
   ┌──────▼──────┐   builds Command/Query, sends on bus
   │    api/     │──────────────────────────────┐
   └──────┬──────┘                              │
          │ CommandBus / QueryBus               │
   ┌──────▼──────────────┐                      │
   │ application/ slices │── uses ──► domain/ aggregate (write side)
   └──────┬──────────────┘                      │
          │ @Inject(SYMBOL) interface           │
   ┌──────▼──────────────┐                      │
   │  infrastructure/    │── maps Model ⇄ Aggregate / ReadModel
   └──────┬──────────────┘
          │ Sequelize
       Postgres

   shared/ is usable from every layer and depends on nothing.
```

| Layer            | May import                                    | Must NOT                                         |
| ---------------- | --------------------------------------------- | ------------------------------------------------ |
| `shared`         | nothing (only its own files)                  | import Nest, Sequelize, or other layers          |
| `domain` (`<Entity>.ts`) | `@shared/*`                           | import Nest, Sequelize, infrastructure           |
| `domain` (`<Entity>Model.ts`) | `sequelize-typescript`, `BaseModel`, `TableNames`, other Models, `@shared/enums` | contain business rules |
| `infrastructure` | `@domain/*`, `@shared/*`, Sequelize           | throw HTTP exceptions, contain business rules    |
| `application`    | `@domain/*`, `@infrastructure/**/abstraction/*`, `@shared/*`, `@application/common/*` | import concrete repositories/queries or Sequelize models |
| `api`            | `@application/**` (Commands, Queries, Requests, Responses), `@shared/utils/Pagination` | inject repositories, contain logic beyond input mapping |

Key principles:

1. **Controllers are thin** — they only map HTTP input → Command/Query and call the bus.
2. **Handlers orchestrate** — load aggregate, call domain methods, persist, return Response.
3. **Aggregates own the rules** — every validation lives in an aggregate method using `Guards`.
4. **Write side ≠ read side** — Commands use a *Repository* (domain aggregates in/out); Queries use a *Queries* class (plain `ReadModel` objects out). Never return a Sequelize model from either.
5. **Depend on abstractions** — handlers inject `I<Entity>Repository` / `I<Entity>Queries` via a `Symbol` token.

---

## 4. Bootstrap & cross-cutting

### `src/main.ts`
```ts
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = new DocumentBuilder()
    .setTitle('Invespy CRM Developer API')
    .setDescription('CRM Developer API')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  await app.listen(process.env.PORT ?? 3002);
}
void bootstrap();
```

### `src/app.module.ts`
```ts
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, ApiModule],
})
export class AppModule {}
```

### `src/api/ApiModule.ts`
Imports every application module, registers every controller, the global
`DomainExceptionFilter` and the request logger.
```ts
@Module({
  imports: [AppApplicationModule, ContactModule /* …every <Entity>Module */],
  controllers: [AppController, ContactController /* …every controller */],
  providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }],
})
export class ApiModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
```

### `src/api/common/ApiConstants.ts`
Single place for route prefixes and Swagger tags.
```ts
export const ApiRoute = { Contact: 'contact' } as const;      // kebab-case
export const SwaggerTag = { Contact: 'Contact' } as const;    // PascalCase
```

### Errors → HTTP (`DomainExceptionFilter`)

Handlers and aggregates throw plain errors from `@shared/errors`; the filter
maps them. **Never throw Nest `HttpException`s from application/domain.**

| Thrown            | Where                                   | HTTP |
| ----------------- | --------------------------------------- | ---- |
| `DomainError`     | aggregate/guard validation failed       | 400  |
| `NotFoundError`   | handler: entity/parent not found        | 404  |
| `ConflictError`   | handler: delete blocked by children, uniqueness, etc. | 409 |

Response body: `{ statusCode, message, error }` where `error` is the error `name`.

```ts
export class DomainError extends Error {
  constructor(message: string) { super(message); this.name = 'DomainError'; }
}
// NotFoundError / ConflictError are identical with their own name.
```

### `RequestLoggerMiddleware`
Logs method, URL, status, duration, params, query and body to stdout (ANSI
colours) on `res.on('finish')`. Plain `process.stdout.write` — no logging library.

---

## 5. Shared kernel (`src/shared`)

| File                          | Purpose |
| ----------------------------- | ------- |
| `enums/EntityStatus.ts`       | `ACTIVE`, `INACTIVE`, `DRAFT` — every aggregate has an `entityStatus` |
| `audit/AuditableFields.ts`    | `{ globalUId, createdAt, modifiedOn }` interface used by the audit hook |
| `domain/Guards.ts`            | `requiredId`, `optionalId`, `requiredText`, `optionalText`, `ensureEntityStatus` — all throw `DomainError` |
| `errors/*`                    | `DomainError`, `NotFoundError`, `ConflictError` |
| `utils/Pagination.ts`         | `DEFAULT_PAGE=1`, `DEFAULT_PAGE_SIZE=50`, `MAX_PAGE_SIZE=100`, `resolvePage()`, `resolvePageSize()` |
| `utils/Slug.ts`               | `slugify()` — NFKD normalise, strip marks, lowercase, non-alnum → `-` |

Guard semantics (important for consistent validation):

- `requiredText(value, field, max)` → trims; empty → `"<field> is required."`; too long → `"<field> must be <max> characters or fewer."`
- `optionalText(value, field, max)` → `null/undefined/blank` → `null`; otherwise trimmed + length check.
- `requiredId(value, field)` → positive integer or `DomainError`.
- `optionalId(value, field)` → `null/undefined` → `null`; otherwise positive integer.
- `ensureEntityStatus(value)` → must be an `EntityStatus` value.

`application/common/PaginationMeta.ts` — `{ currentPage, pageSize, totalItems, totalPages }` with `PaginationMeta.of(page, size, total)`.

---

## 6. Domain layer

Each aggregate lives in `src/domain/aggregates/<Entity>Aggregate/` and has
**two files**:

### 6.1 `BaseModel.ts` (shared columns for every table)
```ts
export abstract class BaseModel extends Model {
  @PrimaryKey @AutoIncrement @Column({ type: DataType.BIGINT }) id!: number;
  @Column({ type: DataType.UUID, allowNull: false }) globalUId!: string;
  @Column({ type: DataType.DATE, allowNull: false }) createdAt!: Date;
  @Column({ type: DataType.DATE, allowNull: true })  modifiedOn!: Date | null;
}
```
`globalUId`, `createdAt`, `modifiedOn` are filled **only** by `AuditHook` — never set them manually.

### 6.2 `TableNames.ts`
```ts
export const TableNames = { Contact: 'Contact' } as const;   // PascalCase table names
export type TableName = (typeof TableNames)[keyof typeof TableNames];
```

### 6.3 `<Entity>Model.ts` — Sequelize persistence model
```ts
@Table({ tableName: TableNames.Contact, timestamps: false })
export class ContactModel extends BaseModel {
  @ForeignKey(() => DeveloperModel)                       // for child aggregates
  @Column({ type: DataType.BIGINT, allowNull: false })
  developerId!: number;

  @BelongsTo(() => DeveloperModel)
  developer!: DeveloperModel;

  @Column({ type: DataType.STRING(255), allowNull: false })
  name!: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  notes!: string | null;

  @Column({ type: DataType.STRING(600), allowNull: true })
  slug!: string | null;

  @Column({ type: DataType.ENUM(...Object.values(EntityStatus)), allowNull: false })
  entityStatus!: EntityStatus;

  @HasMany(() => ContactNoteModel, { onDelete: 'RESTRICT' })   // children block delete
  notesList!: ContactNoteModel[];
}
```
Rules:
- Always `timestamps: false` (audit is ours, not Sequelize's).
- Column lengths in the Model **must match** the `*_MAX_LENGTH` constants in the aggregate.
- Foreign keys are `BIGINT`; relations use `onDelete: 'RESTRICT'` — deletes are guarded in handlers with `ConflictError`.
- Loose cross-service references (e.g. `projectId`, `developerId` owned by another service) are plain nullable `BIGINT` columns with **no** `@ForeignKey`.
- No business logic in Models.

### 6.4 `<Entity>.ts` — the domain aggregate
Pattern (copy exactly):

```ts
import { ensureEntityStatus, optionalText, requiredId, requiredText } from '@shared/domain/Guards';
import { EntityStatus } from '@shared/enums/EntityStatus';

const NAME_MAX_LENGTH = 255;
const NOTES_MAX_LENGTH = 50000;
const SLUG_MAX_LENGTH = 600;

export interface ContactProps {          // input for create()
  developerId: number;
  name: string;
  notes: string | null;
  slug: string | null;
}

export class Contact {
  private constructor(                    // private ctor — only create()/rehydrate()
    private readonly _id: number | null,
    private _developerId: number,
    private _name: string,
    private _notes: string | null,
    private _slug: string | null,
    private _entityStatus: EntityStatus,
  ) {}

  // NEW aggregate: start empty, then run EVERY setter so all rules apply.
  static create(props: ContactProps): Contact {
    const c = new Contact(null, 0, '', null, null, EntityStatus.Active);
    c.changeDeveloper(props.developerId);
    c.rename(props.name);
    c.changeNotes(props.notes);
    c.assignSlug(props.slug);
    return c;
  }

  // FROM DB: trust stored data, no validation.
  static rehydrate(id: number, developerId: number, name: string,
                   notes: string | null, slug: string | null,
                   entityStatus: EntityStatus): Contact {
    return new Contact(id, developerId, name, notes, slug, entityStatus);
  }

  get id(): number | null { return this._id; }
  get developerId(): number { return this._developerId; }
  get name(): string { return this._name; }
  get notes(): string | null { return this._notes; }
  get slug(): string | null { return this._slug; }
  get entityStatus(): EntityStatus { return this._entityStatus; }

  // Intention-revealing behaviour methods — the ONLY way to mutate state.
  rename(name: string): void {
    this._name = requiredText(name, 'Contact name', NAME_MAX_LENGTH);
  }
  changeDeveloper(developerId: number): void {
    this._developerId = requiredId(developerId, 'Contact developer');
  }
  changeNotes(notes: string | null): void {
    this._notes = optionalText(notes, 'Contact notes', NOTES_MAX_LENGTH);
  }
  assignSlug(slug: string | null): void {
    this._slug = optionalText(slug, 'Contact slug', SLUG_MAX_LENGTH);
  }
  changeStatus(status: EntityStatus): void {
    this._entityStatus = ensureEntityStatus(status);
  }
}
```

Aggregate rules:
- No Nest / Sequelize imports. Pure TypeScript + `@shared`.
- Private fields prefixed `_`, read through getters, mutated only through verbs (`rename`, `changeX`, `assignSlug`, `changeStatus`).
- New aggregates default to `EntityStatus.Active`.
- Custom invariants (e.g. valid date) throw `DomainError` directly inside the method.
- Rules needing the DB (slug uniqueness, parent exists, has children) are **not** in the aggregate — the handler checks them via the repository.

---

## 7. Infrastructure layer

### 7.1 `DatabaseModule.ts` (one for the whole service)
```ts
@Module({
  imports: [
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        dialect: 'postgres' as const,
        host: config.get<string>('DB_HOST', 'localhost'),
        port: Number(config.get<string>('DB_PORT', '5436')),
        username: config.get<string>('DB_USER', 'postgres'),
        password: config.get<string>('DB_PASS', 'postgres'),
        database: config.get<string>('DB_NAME', 'invespy_crm'),
        models: [ContactModel /* register EVERY <Entity>Model */],
        autoLoadModels: true,
        synchronize: true,
        logging: false,
      }),
    }),
  ],
})
export class DatabaseModule implements OnModuleInit {
  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}
  onModuleInit(): void { registerAuditHooks(this.sequelize); }
}
```

### 7.2 `hooks/AuditHook.ts` (global, in-house)
- `beforeValidate` (new record) & `beforeBulkCreate` → set `globalUId = crypto.randomUUID()` and `createdAt = new Date()` if missing.
- `beforeUpdate` → `modifiedOn = new Date()`.
- `beforeBulkUpdate` → add `modifiedOn` to `attributes` and `fields` (so `Model.update(...,{where})` stamps it).

### 7.3 Repository (WRITE side)

`repositories/abstraction/IContactRepository.ts`
```ts
import { Contact } from '@domain/aggregates/ContactAggregate/Contact';

export const CONTACT_REPOSITORY = Symbol('CONTACT_REPOSITORY');

export interface IContactRepository {
  save(contact: Contact): Promise<Contact>;            // insert, returns rehydrated aggregate with id
  updateContact(contact: Contact): Promise<void>;      // update by id
  findById(id: number): Promise<Contact | null>;
  delete(id: number): Promise<boolean>;
  slugExists(slug: string, exceptId?: number): Promise<boolean>;
  developerExists(developerId: number): Promise<boolean>;   // parent check (child aggregates)
  hasNotes(contactId: number): Promise<boolean>;            // delete guard (parent aggregates)
}
```

`repositories/ContactRepository.ts`
```ts
@Injectable()
export class ContactRepository implements IContactRepository {
  constructor(
    @InjectModel(ContactModel) private readonly contactModel: typeof ContactModel,
    @InjectModel(DeveloperModel) private readonly developerModel: typeof DeveloperModel,
  ) {}

  async save(contact: Contact): Promise<Contact> {
    const created = await this.contactModel.create({
      developerId: contact.developerId,
      name: contact.name,
      notes: contact.notes,
      slug: contact.slug,
      entityStatus: contact.entityStatus,
    });
    return this.toDomain(created);
  }

  async updateContact(contact: Contact): Promise<void> {
    await this.contactModel.update(
      { developerId: contact.developerId, name: contact.name, notes: contact.notes,
        slug: contact.slug, entityStatus: contact.entityStatus },
      { where: { id: contact.id as number } },
    );
  }

  async findById(id: number): Promise<Contact | null> {
    const row = await this.contactModel.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async delete(id: number): Promise<boolean> {
    return (await this.contactModel.destroy({ where: { id } })) > 0;
  }

  async slugExists(slug: string, exceptId?: number): Promise<boolean> {
    const where = exceptId === undefined ? { slug } : { slug, id: { [Op.ne]: exceptId } };
    return (await this.contactModel.count({ where })) > 0;
  }

  async developerExists(developerId: number): Promise<boolean> {
    return (await this.developerModel.count({ where: { id: developerId } })) > 0;
  }

  private toDomain(row: ContactModel): Contact {
    return Contact.rehydrate(
      Number(row.id),                 // BIGINT comes back as string → Number()
      Number(row.developerId),
      row.name, row.notes, row.slug, row.entityStatus,
    );
  }
}
```

### 7.4 Queries (READ side)

`queries/abstraction/IContactQueries.ts`
```ts
export const CONTACT_QUERIES = Symbol('CONTACT_QUERIES');

export interface ContactReadModel {     // plain, JSON-ready (dates as ISO strings)
  id: number;
  globalUId: string;
  developerId: number;
  name: string;
  notes: string | null;
  slug: string | null;
  entityStatus: string;
  createdAt: string;
  modifiedOn: string | null;
}

export interface ContactListFilter {
  search?: string;
  entityStatus?: string;
  developerId?: number;
  page: number;
  size: number;
}

export interface ContactListResult { rows: ContactReadModel[]; total: number; }

export interface IContactQueries {
  findList(filter: ContactListFilter): Promise<ContactListResult>;
  findById(id: number): Promise<ContactReadModel | null>;
  findBySlug(slug: string): Promise<ContactReadModel | null>;
}
```

`queries/ContactQueries.ts`
```ts
@Injectable()
export class ContactQueries implements IContactQueries {
  constructor(@InjectModel(ContactModel) private readonly contactModel: typeof ContactModel) {}

  async findList(filter: ContactListFilter): Promise<ContactListResult> {
    const conditions: WhereOptions[] = [];
    if (filter.entityStatus) conditions.push({ entityStatus: filter.entityStatus });
    if (filter.developerId !== undefined) conditions.push({ developerId: filter.developerId });
    if (filter.search && filter.search.trim().length > 0) {
      const term = `%${filter.search.trim()}%`;
      conditions.push({ [Op.or]: [
        { name: { [Op.iLike]: term } },
        { notes: { [Op.iLike]: term } },
        { slug: { [Op.iLike]: term } },
      ] });
    }
    const where: WhereOptions = conditions.length > 0 ? { [Op.and]: conditions } : {};

    const { rows, count } = await this.contactModel.findAndCountAll({
      where,
      order: [['id', 'DESC']],
      limit: filter.size,
      offset: (filter.page - 1) * filter.size,
    });
    return { rows: rows.map((r) => this.toReadModel(r)), total: count };
  }

  async findById(id: number) { const r = await this.contactModel.findOne({ where: { id } }); return r ? this.toReadModel(r) : null; }
  async findBySlug(slug: string) { const r = await this.contactModel.findOne({ where: { slug } }); return r ? this.toReadModel(r) : null; }

  private toReadModel(row: ContactModel): ContactReadModel {
    return {
      id: Number(row.id),
      globalUId: row.globalUId,
      developerId: Number(row.developerId),
      name: row.name,
      notes: row.notes,
      slug: row.slug,
      entityStatus: row.entityStatus,
      createdAt: row.createdAt.toISOString(),
      modifiedOn: row.modifiedOn ? row.modifiedOn.toISOString() : null,
    };
  }
}
```

List conventions: `iLike` search over text columns, `Op.and` of conditions, `ORDER BY id DESC`, offset pagination.

### 7.5 `<Entity>PersistenceModule.ts`
Binds the tokens to implementations. Register in `forFeature` **every** model the repo/queries inject (own model + parent/child models used for existence/guard checks).
```ts
@Module({
  imports: [SequelizeModule.forFeature([ContactModel, DeveloperModel, ContactNoteModel])],
  providers: [
    { provide: CONTACT_REPOSITORY, useClass: ContactRepository },
    { provide: CONTACT_QUERIES, useClass: ContactQueries },
  ],
  exports: [CONTACT_REPOSITORY, CONTACT_QUERIES],
})
export class ContactPersistenceModule {}
```

---

## 8. Application layer — Vertical slices

One **module folder per aggregate**, one **feature folder per use case**.
Every feature is self-contained: its message, handler, request DTO and response DTO live together.

```
application/modules/contact/
├── ContactModule.ts
└── features/
    ├── createcontact/        CreateContactCommand · CreateContactCommandHandler · CreateContactRequest · CreateContactResponse
    ├── updatecontact/        UpdateContactCommand · UpdateContactCommandHandler · UpdateContactRequest · UpdateContactResponse
    ├── deletecontact/        DeleteContactCommand · DeleteContactCommandHandler · DeleteContactResponse
    ├── getcontact/           GetContactQuery · GetContactQueryHandler · GetContactResponse
    ├── getcontactbyslug/     GetContactBySlugQuery · GetContactBySlugQueryHandler   (reuses ../getcontact/GetContactResponse)
    └── getcontacts/          GetContactsQuery · GetContactsQueryHandler · GetContactsResponse
```

### 8.1 `<Entity>Module.ts`
```ts
@Module({
  imports: [CqrsModule, ContactPersistenceModule],
  providers: [
    CreateContactCommandHandler,
    UpdateContactCommandHandler,
    DeleteContactCommandHandler,
    GetContactQueryHandler,
    GetContactBySlugQueryHandler,
    GetContactsQueryHandler,
  ],
  exports: [CqrsModule],
})
export class ContactModule {}
```

### 8.2 Command (immutable message)
```ts
export class CreateContactCommand implements ICommand {
  constructor(
    public readonly developerId: number,
    public readonly name: string,
    public readonly notes: string | null,
  ) {}
}
```
For **update (PATCH)** every field is `T | undefined` (or `T | null | undefined` if clearable) plus `id` first and `entityStatus` last:
```ts
export class UpdateContactCommand implements ICommand {
  constructor(
    public readonly id: number,
    public readonly name: string | undefined,
    public readonly notes: string | null | undefined,
    public readonly entityStatus: EntityStatus | undefined,
  ) {}
}
```
`undefined` = leave unchanged, `null` = clear.

### 8.3 Request DTO (HTTP body, Swagger only)
```ts
export class CreateContactRequest {
  @ApiProperty({ example: 1 })
  developerId!: number;

  @ApiProperty({ example: 'Ali Khan', maxLength: 255 })
  name!: string;

  @ApiProperty({ example: 'VIP buyer', required: false, nullable: true })
  notes?: string | null;
}
```
- Requests are **only** documented with `@ApiProperty`; validation happens in the aggregate (no `class-validator`).
- Dates come in as ISO `string`; the controller converts with `new Date(...)`.
- Update requests: every property `required: false`, with `description: 'Omit to leave unchanged; null clears it.'`; include `entityStatus?: EntityStatus` (`enum: EntityStatus`).

### 8.4 Command handlers

**Create**
```ts
@CommandHandler(CreateContactCommand)
export class CreateContactCommandHandler
  implements ICommandHandler<CreateContactCommand, CreateContactResponse> {
  constructor(@Inject(CONTACT_REPOSITORY) private readonly contactRepository: IContactRepository) {}

  async execute(command: CreateContactCommand): Promise<CreateContactResponse> {
    // 1. parent existence (child aggregates only)
    if (!(await this.contactRepository.developerExists(command.developerId))) {
      throw new NotFoundError(`Developer ${command.developerId} was not found.`);
    }
    // 2. DB-dependent rules
    const slug = await this.generateUniqueSlug(command.name);
    // 3. build aggregate (runs all guards)
    const contact = Contact.create({ developerId: command.developerId, name: command.name, notes: command.notes, slug });
    // 4. persist + map
    const saved = await this.contactRepository.save(contact);
    return CreateContactResponse.fromDomain(saved);
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name) || 'contact';
    let candidate = base;
    let suffix = 1;
    while (await this.contactRepository.slugExists(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }
}
```

**Update (PATCH semantics)**
```ts
async execute(command: UpdateContactCommand): Promise<UpdateContactResponse> {
  const contact = await this.contactRepository.findById(command.id);
  if (!contact) throw new NotFoundError(`Contact ${command.id} was not found.`);

  if (command.name !== undefined)         contact.rename(command.name);
  if (command.notes !== undefined)        contact.changeNotes(command.notes);
  if (command.entityStatus !== undefined) contact.changeStatus(command.entityStatus);

  await this.contactRepository.updateContact(contact);
  return UpdateContactResponse.fromDomain(contact);
}
```
Slug is generated once on create and is **not** regenerated on rename.

**Delete**
```ts
async execute(command: DeleteContactCommand): Promise<DeleteContactResponse> {
  const contact = await this.contactRepository.findById(command.id);
  if (!contact) throw new NotFoundError(`Contact ${command.id} was not found.`);

  if (await this.contactRepository.hasNotes(command.id)) {
    throw new ConflictError(`Contact ${command.id} has notes and cannot be deleted.`);
  }

  const deleted = await this.contactRepository.delete(command.id);
  return DeleteContactResponse.of(command.id, deleted);
}
```
Deletes are hard deletes; to "archive", PATCH `entityStatus` to `INACTIVE`.

### 8.5 Query + handlers
```ts
export class GetContactQuery implements IQuery { constructor(public readonly id: number) {} }
export class GetContactBySlugQuery implements IQuery { constructor(public readonly slug: string) {} }
export class GetContactsQuery implements IQuery { constructor(public readonly filter: ContactListFilter) {} }

@QueryHandler(GetContactQuery)
export class GetContactQueryHandler implements IQueryHandler<GetContactQuery, GetContactResponse> {
  constructor(@Inject(CONTACT_QUERIES) private readonly contactQueries: IContactQueries) {}
  async execute(query: GetContactQuery): Promise<GetContactResponse> {
    const contact = await this.contactQueries.findById(query.id);
    if (!contact) throw new NotFoundError(`Contact ${query.id} was not found.`);
    return GetContactResponse.from(contact);
  }
}

@QueryHandler(GetContactsQuery)
export class GetContactsQueryHandler implements IQueryHandler<GetContactsQuery, GetContactsResponse> {
  constructor(@Inject(CONTACT_QUERIES) private readonly contactQueries: IContactQueries) {}
  async execute(query: GetContactsQuery): Promise<GetContactsResponse> {
    const { rows, total } = await this.contactQueries.findList(query.filter);
    return GetContactsResponse.from(rows, query.filter.page, query.filter.size, total);
  }
}
```
Query handlers **never** touch the repository or the aggregate.

### 8.6 Response DTOs
Each slice owns its response. All properties annotated with `@ApiProperty({ example, nullable? })`.

| Response | Built from | Factory | Contains |
| -------- | ---------- | ------- | -------- |
| `Create/Update<Entity>Response` | domain aggregate | `static fromDomain(entity)` (field-by-field copy, `id as number`) | business fields + `slug` + `entityStatus` |
| `Delete<Entity>Response` | id + bool | `static of(id, deleted)` | `{ id, deleted }` |
| `Get<Entity>Response` | `ReadModel` | `static from(rm) { return Object.assign(new GetXResponse(), rm); }` | business fields + `globalUId`, `createdAt`, `modifiedOn` |
| `Get<Entities>Response` | `ReadModel[]` | `static from(rows, page, size, total)` | `items: Get<Entities>ResponseItem[]`, `meta: PaginationMeta` |

```ts
export class GetContactsResponse {
  @ApiProperty({ type: [GetContactsResponseItem] }) items!: GetContactsResponseItem[];
  @ApiProperty({ type: PaginationMeta }) meta!: PaginationMeta;

  static from(rows: ContactReadModel[], page: number, size: number, total: number): GetContactsResponse {
    const r = new GetContactsResponse();
    r.items = rows.map((row) => ({ ...row }));
    r.meta = PaginationMeta.of(page, size, total);
    return r;
  }
}
```

---

## 9. API layer — Controller

One controller per aggregate in `src/api/controllers/<Entity>Controller.ts`.
Injects **only** `CommandBus` and `QueryBus`.

```ts
@ApiTags(SwaggerTag.Contact)
@Controller(ApiRoute.Contact)
export class ContactController {
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

  @Post()
  @ApiOperation({ summary: 'Create a contact' })
  @ApiResponse({ status: 201, type: CreateContactResponse })
  @ApiResponse({ status: 400, description: 'A required field is invalid' })
  @ApiResponse({ status: 404, description: 'Developer was not found' })
  create(@Body() request: CreateContactRequest): Promise<CreateContactResponse> {
    return this.commandBus.execute<CreateContactCommand, CreateContactResponse>(
      new CreateContactCommand(request.developerId, request.name, request.notes ?? null),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List contacts (search, filter, paginate)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'entityStatus', required: false, enum: ['ACTIVE', 'INACTIVE', 'DRAFT'] })
  @ApiQuery({ name: 'developerId', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiResponse({ status: 200, type: GetContactsResponse })
  findAll(
    @Query('search') search?: string,
    @Query('entityStatus') entityStatus?: string,
    @Query('developerId') developerId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ): Promise<GetContactsResponse> {
    return this.queryBus.execute<GetContactsQuery, GetContactsResponse>(
      new GetContactsQuery({
        search,
        entityStatus,
        developerId: developerId ? Number(developerId) : undefined,
        page: resolvePage(page),
        size: resolvePageSize(size),
      }),
    );
  }

  @Get('slug/:slug')        // MUST be declared before ':id'
  findBySlug(@Param('slug') slug: string): Promise<GetContactResponse> {
    return this.queryBus.execute(new GetContactBySlugQuery(slug));
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<GetContactResponse> {
    return this.queryBus.execute(new GetContactQuery(id));
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() request: UpdateContactRequest) {
    return this.commandBus.execute(
      new UpdateContactCommand(id, request.name, request.notes, request.entityStatus),
    );
  }

  @Delete(':id')
  @ApiResponse({ status: 409, description: 'Contact has notes and cannot be deleted' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<DeleteContactResponse> {
    return this.commandBus.execute(new DeleteContactCommand(id));
  }
}
```

Controller conventions:
- Standard endpoint set per aggregate:

  | Method | Path            | Slice            | Codes            |
  | ------ | --------------- | ---------------- | ---------------- |
  | POST   | `/`             | `create<x>`      | 201, 400, 404*   |
  | GET    | `/`             | `get<x>s`        | 200              |
  | GET    | `/slug/:slug`   | `get<x>byslug`   | 200, 404         |
  | GET    | `/:id`          | `get<x>`         | 200, 404         |
  | PATCH  | `/:id`          | `update<x>`      | 200, 400, 404    |
  | DELETE | `/:id`          | `delete<x>`      | 200, 404, 409    |
  \* 404 on create only for child aggregates (parent missing).
- `?? null` for optional create fields; pass raw (possibly `undefined`) values for PATCH.
- Booleans in query string: `'true' → true`, `'false' → false`, else `undefined`.
- Ids via `ParseIntPipe`; page/size via `resolvePage` / `resolvePageSize`.
- Every endpoint has `@ApiOperation` and `@ApiResponse` for each status it can return.

---

## 10. Naming conventions

| Thing                  | Convention                         | Example |
| ---------------------- | ---------------------------------- | ------- |
| Files / classes        | PascalCase, one class per file     | `ContactRepository.ts` |
| Module folder          | lowercase, no separators           | `modules/contactnote/` |
| Feature folder         | lowercase verb+noun, no separators | `features/getcontactbyslug/` |
| Aggregate folder       | `<Entity>Aggregate`                | `ContactAggregate/` |
| Domain class / model   | `<Entity>` / `<Entity>Model`       | `Contact`, `ContactModel` |
| DI token               | `SCREAMING_SNAKE` `Symbol`         | `CONTACT_REPOSITORY`, `CONTACT_QUERIES` |
| Interfaces             | `I` prefix                         | `IContactRepository` |
| Read model / filter    | `<Entity>ReadModel`, `<Entity>ListFilter`, `<Entity>ListResult` | |
| Repo update method     | `update<Entity>`                   | `updateContact` |
| Route                  | kebab-case singular                | `contact`, `contact-note` |
| Table name             | PascalCase singular                | `Contact`, `ContactNote` |
| Error messages         | `"<Entity> <id> was not found."`, `"<Entity> <id> has <children> and cannot be deleted."` | |

---

## 11. Recipe — adding a new module (checklist)

For an aggregate `Foo` (child of `Bar`):

1. **Shared/Domain**
   - [ ] `TableNames.Foo = 'Foo'`
   - [ ] `domain/aggregates/FooAggregate/FooModel.ts` (extends `BaseModel`, `timestamps: false`, `@ForeignKey(() => BarModel)` + `@BelongsTo`, `entityStatus` enum column)
   - [ ] Add `@HasMany(() => FooModel, { onDelete: 'RESTRICT' })` on `BarModel`
   - [ ] `domain/aggregates/FooAggregate/Foo.ts` (`FooProps`, private ctor, `create`, `rehydrate`, getters, guarded mutators, `changeStatus`)
2. **Infrastructure**
   - [ ] `repositories/abstraction/IFooRepository.ts` (+ `FOO_REPOSITORY` symbol)
   - [ ] `repositories/FooRepository.ts` (`save`, `updateFoo`, `findById`, `delete`, `slugExists`, `barExists`, `has<Children>`, `toDomain`)
   - [ ] `queries/abstraction/IFooQueries.ts` (+ `FOO_QUERIES`, `FooReadModel`, `FooListFilter`, `FooListResult`)
   - [ ] `queries/FooQueries.ts` (`findList`, `findById`, `findBySlug`, `toReadModel`)
   - [ ] `persistence/FooPersistenceModule.ts` (`forFeature` all used models, bind + export tokens)
   - [ ] Register `FooModel` in `DatabaseModule.models`
   - [ ] If `Bar` must block delete when it has `Foo`s: add `hasFoos()` to `IBarRepository`, register `FooModel` in `BarPersistenceModule`, check in `DeleteBarCommandHandler`
3. **Application** — `application/modules/foo/`
   - [ ] `features/createfoo/` Command, Handler, Request, Response
   - [ ] `features/updatefoo/` Command, Handler, Request, Response
   - [ ] `features/deletefoo/` Command, Handler, Response
   - [ ] `features/getfoo/` Query, Handler, Response
   - [ ] `features/getfoobyslug/` Query, Handler (reuse `GetFooResponse`)
   - [ ] `features/getfoos/` Query, Handler, Response (+ `GetFoosResponseItem`)
   - [ ] `FooModule.ts` (`CqrsModule`, `FooPersistenceModule`, all handlers, export `CqrsModule`)
4. **API**
   - [ ] `ApiRoute.Foo = 'foo'`, `SwaggerTag.Foo = 'Foo'`
   - [ ] `controllers/FooController.ts`
   - [ ] Add `FooModule` to `ApiModule.imports` and `FooController` to `ApiModule.controllers`
5. **Test** (§17.3)
   - [ ] `Foo.spec.ts` (aggregate), one `*.spec.ts` per handler
   - [ ] `FooRepository.int-spec.ts`, `FooQueries.int-spec.ts`
   - [ ] `test/foo.e2e-spec.ts` (all 6 endpoints + 400/404/409)
6. **Verify**
   - [ ] §18.4 pre-flight is green (build, lint, boundaries, all test suites, coverage)
   - [ ] `npm run start:dev`, check `/docs`, exercise all 6 endpoints incl. 400/404/409 paths

---

## 12. Request lifecycle (end-to-end)

```
PATCH /contact/7  { "name": "  " }
  │
  ├─ RequestLoggerMiddleware (logs on finish)
  ├─ ContactController.update → new UpdateContactCommand(7, '  ', undefined, undefined)
  ├─ CommandBus → UpdateContactCommandHandler.execute
  │     ├─ contactRepository.findById(7)  → ContactModel → Contact.rehydrate(...)
  │     ├─ contact.rename('  ')           → requiredText → throw DomainError('Contact name is required.')
  │
  └─ DomainExceptionFilter → 400 { statusCode: 400, message: 'Contact name is required.', error: 'DomainError' }
```

Happy path: aggregate mutates → `updateContact` → `Model.update` → `AuditHook.beforeBulkUpdate` stamps `modifiedOn` → `UpdateContactResponse.fromDomain(contact)` → 200.

---

## 13. Environment & local DB

`.env.example`
```
PORT=3002
DB_HOST=localhost
DB_PORT=5436
DB_USER=postgres
DB_PASS=postgres
DB_NAME=invespy_crm
```

`docker-compose.yml` — single `postgres:16-alpine` service with `pg_isready`
healthcheck and a named volume. No other containers.

Schema is created by Sequelize `synchronize: true` from the registered Models
(no migration tool). Scripts: `npm run start:dev` (runs `tsc-alias -w` + `nest start --watch`),
`npm run build` (`nest build && tsc-alias`).

> Port/DB name above are suggestions for this service so it can run beside the
> feeds service (3001 / 5435 / `invespy_feed`); adjust as needed.

---

## 14. Do / Don't summary

**Do**
- Keep each use case in its own feature folder.
- Put every validation in the aggregate via `Guards`.
- Split writes (Repository + aggregate) from reads (Queries + ReadModel).
- Inject by `Symbol` token against an interface.
- Throw `DomainError` / `NotFoundError` / `ConflictError` and let the filter map them.
- Document every endpoint and DTO property in Swagger.

**Don't**
- Don't add third-party SDKs/services (storage, mail, queues, auth providers, caches, loggers, validators).
- Don't return Sequelize models from repositories, queries or controllers.
- Don't put logic in controllers or Models.
- Don't call one module's handlers from another module; if you need a parent check, add an `xExists()` method on your own repository.
- Don't set `globalUId` / `createdAt` / `modifiedOn` manually.
- Don't use Sequelize `timestamps` or `paranoid`.

---

## 15. Coding practices

These apply to every file in `src/` and `test/`. Sections 15–19 are as
binding as sections 1–14, and they apply in the same way to code written by
AI assistants.

### 15.1 TypeScript
- `tsconfig.json` uses `"strict": true`. Never weaken it per file.
- **No `any`.** Use `unknown` and narrow it. Each `as` cast needs a reason. The
  allowed exceptions are `id as number` after a save and Sequelize `where` typing.
- Use the `!` definite-assignment operator **only** on Sequelize Model columns and
  Request/Response DTO properties. Never use the `x!` non-null assertion on values.
- Give every exported function and public method an explicit return type.
- Mark constructor-injected dependencies and all Command/Query fields `readonly`.
- Use named exports only. No `export default` and no barrel `index.ts` files,
  so that slices stay explicit.
- Prefer `const`, never use `var`, and always compare with `===`.
- Use `async/await` only and never chain `.then()`. Don't leave promises
  floating; the only exception is `void bootstrap()`.

### 15.2 `null` vs `undefined`
| Value       | Meaning                    | Where it may appear |
| ----------- | -------------------------- | ------------------- |
| `null`      | "no value" (stored as SQL `NULL`) | aggregates, models, read models, responses |
| `undefined` | "not provided / leave unchanged" | PATCH commands and requests, optional query params |

- Optional create fields are normalised in the controller with `?? null`.
- Aggregates and read models never hold `undefined`.
- Never use `null` to mean "leave unchanged".

### 15.3 Naming, size and readability
- Name methods with verbs (`rename`, `changeNotes`, `findList`). Booleans start
  with `is`, `has` or `exists` (`hasNotes`, `slugExists`).
- No magic numbers or strings. Put them in `SCREAMING_SNAKE` constants at the
  top of the file, such as `NAME_MAX_LENGTH`, or in shared constants like
  `MAX_PAGE_SIZE`, `TableNames` and `ApiRoute`.
- Guidelines: a function has **≤ 30 lines**, nesting is **≤ 3 levels** and a
  file has **≤ 200 lines**. Above that, extract a private method. Exceptions
  are controllers and aggregates with many fields.
- Prefer guard clauses and early returns to `else` chains.
- Put one class in each file, and name the file after the class.

### 15.4 Imports
Import order, with one blank line between groups:
1. Node built-ins (`crypto`)
2. `@nestjs/*`
3. Other packages (`sequelize`, `sequelize-typescript`)
4. Path aliases, in layer order: `@shared`, `@domain`, `@infrastructure`, `@application`, `@api`
5. Relative imports (`./`) — **only inside the same slice folder**

Never use `../../`. The one allowed `../` is a slice reusing a sibling slice's
response, for example `../getcontact/GetContactResponse`.

### 15.5 Errors
- Throw only `DomainError`, `NotFoundError` and `ConflictError`, as in §4.
- Use the message formats exactly: `"<Entity> <id> was not found."` and
  `"<Entity> <id> has <children> and cannot be deleted."`. Guard messages
  come from `Guards`.
- Never swallow an error: no empty `catch` blocks and no `catch` that only logs.
  Handlers don't use `try/catch` unless they translate an error.
- Messages must never leak internals such as SQL, stack traces or column names.

### 15.6 Persistence
- Check existence with `count(...) > 0`, not `findOne`.
- Convert every `BIGINT` read from the DB with `Number(...)`, both in
  `toDomain` and in `toReadModel`.
- Read models expose dates as ISO strings (`toISOString()`).
- Lists always have `order`, `limit` and `offset`, and the size is capped by
  `resolvePageSize`.
- **No queries inside loops.** The one exception is the bounded slug-uniqueness
  loop. Load related data with `include` or a single `IN` query.
- Never build raw SQL by string concatenation. Use the Sequelize query API.
  Raw SQL needs a reviewer's approval and must use `replacements`.

### 15.7 Comments, logging and dead code
- Comments explain **why**, not what. Don't leave commented-out code.
- A `TODO` must reference an OpenSpec change or an issue:
  `// TODO(add-contact-tags): …`.
- No `console.*` calls. Only `RequestLoggerMiddleware` writes to stdout.
- Remove unused imports, variables, parameters and files.

### 15.8 Lint and format
- `npm run lint` must report **0 errors and 0 warnings**, and `npm run format:check` must pass.
- Prettier is the formatter: `singleQuote`, `trailingComma: all`. Don't format by hand.
- An `eslint-disable` comment must be on a single line and include a reason:
  `// eslint-disable-next-line <rule> -- <reason>`.

### 15.9 Security
- Never put secrets in code, tests or fixtures. Configuration comes from
  `ConfigService` and `.env`, and only `.env.example` is committed.
- Parse every id with `ParseIntPipe`, and every page and size with
  `resolvePage` / `resolvePageSize`.
- Never trust input in a handler or the domain. All validation goes through
  the aggregate's `Guards`.

---

## 16. Rules and boundaries

### 16.1 Hard rules (blockers)
Breaking any hard rule blocks the PR, whatever its score (see §19.1).

| ID  | Rule | Automated check |
| --- | ---- | --------------- |
| R1  | Runtime `dependencies` come only from the §1 allowlist | yes |
| R2  | `shared/` imports nothing outside `shared/`: no Nest, no Sequelize, no other layer | yes |
| R3  | Domain aggregates (`<Entity>.ts`) import only `@shared/*` | yes |
| R4  | `application/` never imports concrete repositories or queries, Sequelize Models or `sequelize` | yes |
| R5  | `api/` never imports `@infrastructure`, `@domain` or `sequelize` | yes |
| R6  | No Nest `HttpException` (or its subclasses) outside `api/` | yes |
| R7  | Audit fields (`globalUId`, `createdAt`, `modifiedOn`) are never set outside `AuditHook` | yes |
| R8  | Sequelize `timestamps` and `paranoid` are never enabled | yes |
| R9  | Handlers never inject `CommandBus`/`QueryBus`, so they make no cross-module handler calls | yes |
| R10 | No raw `sequelize.query` without approval (§15.6) | yes |
| R11 | No `console.*` in `src/` | yes |
| R12 | `sync({ force })` / `sync({ alter })` are never used | yes |
| R13 | Repositories, queries, handlers and controllers never return Sequelize Models | review |
| R14 | No business rules in controllers, Models or DTOs | review |
| R15 | No secrets or `.env` files committed | review |

`scripts/check-boundaries.sh` runs the automated checks. Wire it up as
`npm run check:boundaries`. Every check must print nothing.

```bash
#!/usr/bin/env bash
# Hard-rule checks (ARCHITECTURE.md §16.1). Exit 1 if any rule is violated.
set -u
cd "$(dirname "$0")/.."
fail=0
run() {
  local out; out=$(cat)
  if [ -n "$out" ]; then printf '✗ %s\n%s\n\n' "$1" "$out"; fail=1; else printf '✓ %s\n' "$1"; fi
}

run 'R1 runtime deps allowlist' < <(node -e "
  const allowed = new Set(['@nestjs/common','@nestjs/config','@nestjs/core','@nestjs/cqrs',
    '@nestjs/platform-express','@nestjs/sequelize','@nestjs/swagger','pg','pg-hstore',
    'reflect-metadata','rxjs','sequelize','sequelize-typescript']);
  const extra = Object.keys(require('./package.json').dependencies || {}).filter((d) => !allowed.has(d));
  if (extra.length) console.log(extra.join('\n'));")
run 'R2 shared is framework-free' < <(grep -rnE "from '(@nestjs|sequelize|@api|@application|@domain|@infrastructure)" src/shared)
run 'R3 aggregates are pure'      < <(grep -rnE "from '(@nestjs|sequelize|@api|@application|@infrastructure)" src/domain | grep -v 'Model.ts')
run 'R4 application uses abstractions' < <(grep -rnE "from '(@infrastructure/(repositories|queries)/[A-Z]|@domain/aggregates/.*Model'|sequelize)" src/application)
run 'R5 api talks to buses only'  < <(grep -rnE "from '(@infrastructure/|@domain/|sequelize)" src/api)
run 'R6 no HttpException below api' < <(grep -rnE "HttpException|(BadRequest|NotFound|Conflict|Unauthorized|Forbidden|InternalServerError)Exception" src/application src/domain src/infrastructure src/shared)
run 'R7 audit fields untouched'   < <(grep -rnE "globalUId|createdAt|modifiedOn" src/infrastructure/repositories src/domain/aggregates | grep -v 'Model.ts')
run 'R8 no timestamps/paranoid'   < <(grep -rnE "(timestamps|paranoid):\s*true" src)
run 'R9 no buses in handlers'     < <(grep -rnE "CommandBus|QueryBus" src/application)
run 'R10 no raw SQL'              < <(grep -rn "sequelize.query" src)
run 'R11 no console'              < <(grep -rnE "console\.(log|info|warn|error|debug)" src)
run 'R12 no force/alter sync'     < <(grep -rnE "(force|alter):\s*true" src)

exit $fail
```

### 16.2 Layer boundaries
§3 is the source of truth. One clarification: `<Entity>Module.ts` is the
**only** application file that may import `@infrastructure/persistence/<Entity>PersistenceModule`.

### 16.3 Change boundaries (scope)
- **One PR covers one OpenSpec change** (or one bug fix). Don't add
  "while I'm here" edits.
- A feature PR touches only its own module plus these registration points:
  `TableNames`, `DatabaseModule.models`, `ApiConstants`, `ApiModule`, the
  parent's `@HasMany`, and the parent repository's `has<Children>()` with its
  delete guard.
- **The architecture is frozen inside feature PRs.** A change to a pattern in
  this guide needs its own `docs(architecture)` PR, approved by a maintainer,
  before any code uses the new pattern.
- **No breaking API changes** without an OpenSpec spec delta marked
  `BREAKING`. That includes renaming or removing an endpoint, response field or
  query param, or changing a status code.
- **Database:** `synchronize: true` only **creates missing tables**. It never
  alters existing ones. Any change to an existing table needs the exact manual
  SQL under "DB changes" in the PR description. That covers a new column and a
  change to a column's type, length, nullability or name.
- No new runtime dependency (R1). A new **dev** dependency must be justified in
  the PR description.

---

## 17. Testing

### 17.1 Tooling
- `jest`, `ts-jest`, `@types/jest`, `@nestjs/testing`, and `supertest` for e2e
  only. These are **devDependencies** only.
- Jest `moduleNameMapper` mirrors the path aliases:

```json
"jest": {
  "rootDir": "src",
  "moduleFileExtensions": ["js", "json", "ts"],
  "testRegex": ".*\\.spec\\.ts$",
  "transform": { "^.+\\.ts$": "ts-jest" },
  "testEnvironment": "node",
  "moduleNameMapper": {
    "^@api/(.*)$": "<rootDir>/api/$1",
    "^@application/(.*)$": "<rootDir>/application/$1",
    "^@domain/(.*)$": "<rootDir>/domain/$1",
    "^@infrastructure/(.*)$": "<rootDir>/infrastructure/$1",
    "^@shared/(.*)$": "<rootDir>/shared/$1"
  },
  "collectCoverageFrom": ["**/*.ts", "!**/*.spec.ts", "!**/*.int-spec.ts", "!**/*Module.ts", "!**/*Model.ts", "!main.ts"],
  "coverageDirectory": "../coverage",
  "coverageThreshold": {
    "global":        { "lines": 85, "branches": 80, "functions": 85, "statements": 85 },
    "./shared/":     { "lines": 95, "branches": 95 },
    "./domain/":     { "lines": 95, "branches": 95 },
    "./application/":{ "lines": 90, "branches": 85 }
  }
}
```

### 17.2 Test types
| Type        | What it tests | File | Location | Database | Command |
| ----------- | ------------- | ---- | -------- | -------- | ------- |
| Unit        | aggregates, `Guards`, `Slug`, `Pagination`, handlers, Responses, controllers | `<File>.spec.ts` | next to the source file | none | `npm test` |
| Integration | `<Entity>Repository`, `<Entity>Queries`, `AuditHook` | `<File>.int-spec.ts` | next to the source file | real Postgres `invespy_crm_test` | `npm run test:int` |
| E2E         | full HTTP flow through `AppModule` | `<entity>.e2e-spec.ts` | `test/` | real Postgres `invespy_crm_test` | `npm run test:e2e` |

- Never use SQLite or an in-memory DB for integration tests, because `iLike`,
  `BIGINT` and `ENUM` behave differently there.
- The test database must be named `*_test`. Integration and e2e setup **must
  refuse to run** otherwise, because the tests truncate tables. Create the
  database once with
  `docker compose exec postgres createdb -U postgres invespy_crm_test`.

### 17.3 What every module must test
| Target | Required cases |
| ------ | -------------- |
| Aggregate `<Entity>.ts` | `create` defaults `entityStatus` to `ACTIVE` and `id` to `null`. For every mutator: valid value, trimming, required → blank throws `DomainError` with the exact message, **max length passes and max+1 fails**, optional → `null`/blank becomes `null`. `rehydrate` does **not** validate. `changeStatus` rejects an invalid value. |
| Shared kernel | every `Guards` function, `slugify` (accents, symbols, empty), `resolvePage`/`resolvePageSize` (missing, invalid, over max) |
| Create handler | happy path; parent missing → `NotFoundError` (child aggregates); slug collision → `-1`, `-2` suffix; invalid input → `DomainError` and `save` not called |
| Update handler | not found → `NotFoundError`; `undefined` field left unchanged; `null` clears it; slug **not** regenerated on rename |
| Delete handler | not found → `NotFoundError`; has children → `ConflictError` and `delete` not called; happy path returns `{ id, deleted: true }` |
| Query handlers | found → Response; not found → `NotFoundError`; list passes the filter through and builds `PaginationMeta` |
| Repository (int) | `save` returns an aggregate with a numeric `id`; `update<Entity>` persists and `modifiedOn` is stamped; `slugExists` honours `exceptId`; `<parent>Exists` and `has<Children>` |
| Queries (int) | case-insensitive `search`, each filter, pagination, `ORDER BY id DESC`, ISO dates, numeric ids |
| E2E | all 6 endpoints (§9) with the success code **and** every 400/404/409 path, plus the error body `{ statusCode, message, error }` |

### 17.4 Conventions
- Structure: `describe('<Class>')` → `describe('<method>')` → `it('should <outcome> when <condition>')`.
- Arrange / Act / Assert, with **one behaviour per test**. Tests don't depend on order or on each other.
- Construct handlers directly with `new` and pass `jest.Mocked<I<Entity>Repository>`
  or `jest.Mocked<I<Entity>Queries>`. Use `Test.createTestingModule` only for
  integration and e2e tests.
- **Never mock aggregates, Guards or shared utilities.** Use the real ones and
  build test aggregates with `create(...)` or `rehydrate(...)`.
- Assert the **error class and the exact message**.
- Integration and e2e tests truncate in `beforeEach`
  (`sequelize.truncate({ cascade: true, restartIdentity: true })`) and close the app in `afterAll`.
- No `sleep` and no dependence on the wall clock. Use `jest.useFakeTimers()` or relative assertions.
- No `.only`, and no `.skip` without a TODO that references a change.

### 17.5 Examples

Aggregate (unit):
```ts
import { EntityStatus } from '@shared/enums/EntityStatus';
import { DomainError } from '@shared/errors/DomainError';

import { Contact, ContactProps } from './Contact';

const validProps = (overrides: Partial<ContactProps> = {}): ContactProps => ({
  developerId: 1,
  name: 'Ali Khan',
  notes: null,
  slug: 'ali-khan',
  ...overrides,
});

describe('Contact', () => {
  describe('create', () => {
    it('should default entityStatus to ACTIVE when created', () => {
      const contact = Contact.create(validProps());

      expect(contact.entityStatus).toBe(EntityStatus.Active);
      expect(contact.id).toBeNull();
    });
  });

  describe('rename', () => {
    it('should throw DomainError when name is blank', () => {
      const contact = Contact.create(validProps());

      const act = (): void => contact.rename('   ');

      expect(act).toThrow(DomainError);
      expect(act).toThrow('Contact name is required.');
    });

    it('should accept a name of exactly 255 characters', () => {
      const contact = Contact.create(validProps());

      contact.rename('a'.repeat(255));

      expect(contact.name).toHaveLength(255);
    });

    it('should throw DomainError when name exceeds 255 characters', () => {
      const contact = Contact.create(validProps());

      expect(() => contact.rename('a'.repeat(256))).toThrow('Contact name must be 255 characters or fewer.');
    });
  });
});
```

Command handler (unit):
```ts
describe('DeleteContactCommandHandler', () => {
  let repository: jest.Mocked<IContactRepository>;
  let handler: DeleteContactCommandHandler;

  beforeEach(() => {
    repository = {
      save: jest.fn(),
      updateContact: jest.fn(),
      findById: jest.fn(),
      delete: jest.fn(),
      slugExists: jest.fn(),
      developerExists: jest.fn(),
      hasNotes: jest.fn(),
    };
    handler = new DeleteContactCommandHandler(repository);
  });

  it('should throw ConflictError when contact has notes', async () => {
    repository.findById.mockResolvedValue(Contact.rehydrate(7, 1, 'Ali', null, 'ali', EntityStatus.Active));
    repository.hasNotes.mockResolvedValue(true);

    const act = handler.execute(new DeleteContactCommand(7));

    await expect(act).rejects.toBeInstanceOf(ConflictError);
    await expect(act).rejects.toThrow('Contact 7 has notes and cannot be deleted.');
    expect(repository.delete).not.toHaveBeenCalled();
  });
});
```

Repository (integration):
```ts
describe('ContactRepository', () => {
  let moduleRef: TestingModule;
  let sequelize: Sequelize;
  let repository: IContactRepository;

  beforeAll(async () => {
    if (!process.env.DB_NAME?.endsWith('_test')) throw new Error('Integration tests require a *_test database.');
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, ContactPersistenceModule],
    }).compile();
    await moduleRef.init();                       // runs DatabaseModule.onModuleInit → AuditHook
    sequelize = moduleRef.get(Sequelize);
    repository = moduleRef.get(CONTACT_REPOSITORY);
  });

  beforeEach(() => sequelize.truncate({ cascade: true, restartIdentity: true }));
  afterAll(() => moduleRef.close());

  it('should return a numeric id when saved', async () => { /* … */ });
});
```

### 17.6 Required npm scripts
```json
"scripts": {
  "build": "nest build && tsc-alias",
  "lint": "eslint \"{src,test}/**/*.ts\" --max-warnings 0",
  "format": "prettier --write \"{src,test}/**/*.ts\"",
  "format:check": "prettier --check \"{src,test}/**/*.ts\"",
  "test": "jest",
  "test:int": "DB_NAME=invespy_crm_test jest --testRegex '\\.int-spec\\.ts$' --runInBand",
  "test:e2e": "DB_NAME=invespy_crm_test jest --config ./test/jest-e2e.json --runInBand",
  "test:cov": "DB_NAME=invespy_crm_test jest --coverage --testRegex '\\.(int-)?spec\\.ts$' --runInBand",
  "check:boundaries": "bash scripts/check-boundaries.sh"
}
```
Coverage (`test:cov`) runs unit and integration tests together, because
infrastructure is covered by the integration tests.

---

## 18. Pull requests

### 18.1 Branches
`<type>/<name>`, where `<name>` is the OpenSpec change folder name when one exists.

| Type        | Use for | Example |
| ----------- | ------- | ------- |
| `feat/`     | new behaviour | `feat/add-contact-module` |
| `fix/`      | bug fix | `fix/contact-slug-collision` |
| `refactor/` | no behaviour change | `refactor/contact-queries-filter` |
| `test/`     | tests only | `test/contact-repository-int` |
| `docs/`     | docs and the architecture guide | `docs/architecture-testing-rules` |
| `chore/`    | tooling, config, deps (dev only) | `chore/jest-coverage-thresholds` |

### 18.2 Commits
- Use [Conventional Commits](https://www.conventionalcommits.org): `type(scope): subject`.
  The scope is the module (`contact`) or the layer (`shared`, `api`).
- Write the subject in the imperative, lowercase, with no trailing period and
  **≤ 72 characters**. Example: `feat(contact): add delete guard for notes`.
- Each commit is one logical step. PRs are **squash-merged**, so the PR title
  becomes the final commit message.

### 18.3 Size and scope
- At most **400 changed lines**, excluding tests, `openspec/` and lock files.
  Split larger work **by aggregate**, never by layer, so that every PR is a
  working vertical slice.
- Every PR follows the scope rules in §16.3.

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
openspec validate <change-name>     # when the PR implements an OpenSpec change
```
Then run `npm run start:dev`, open `/docs`, and confirm that every new
endpoint, schema and status code is documented.

### 18.5 PR title and description
The title is in Conventional Commit format, the same as §18.2.

~~~markdown
## What
<one-paragraph summary of the behaviour added/changed>

## Why
OpenSpec change: `openspec/changes/<change-name>/`

## Endpoints
| Method | Path | Success | Errors |
| ------ | ---- | ------- | ------ |
| POST   | /contact | 201 | 400, 404 |

## DB changes
None | New table `<Name>` (created by synchronize) | Manual SQL:
```sql
ALTER TABLE "Contact" ADD COLUMN "phone" VARCHAR(30) NULL;
```

## Tests
- Unit: <files>
- Integration: <files>
- E2E: <files>
- Coverage: lines __% / branches __%

## Checklist
- [ ] §11 recipe complete (all registrations done)
- [ ] §18.4 pre-flight all green
- [ ] No hard-rule violations (§16.1)
- [ ] Swagger checked at /docs

## Self-score (§19)
<paste scorecard>
~~~

### 18.6 Review process
1. The author opens the PR with the pre-flight green and a self-score.
2. At least **1 approving review** is required. The reviewer checks in this
   order: **hard rules → domain rules → tests → everything else**, and then
   fills in the scorecard. The reviewer's score is final.
3. Mark each comment as blocking or not: prefix it with `blocker:`, `minor:`
   or `nit:`. The author replies to every comment, and the reviewer resolves
   the threads.
4. Once review has started, don't force-push. Push follow-up commits; the PR is squashed on merge.
5. Squash-merge only when the grade allows it (§19.4), then delete the branch
   and run `openspec archive <change-name>`.

---

## 19. Scoring system

Every PR gets a score out of **100**, from the author (self-score) and from the
reviewer (final). Scoring happens in two stages: a **gate**, then a **weighted rubric**.

### 19.1 Gate (pass/fail)
If any gate item fails, **score = 0** and the PR is blocked until it is fixed.

| ID | Gate |
| -- | ---- |
| G1 | `npm run build` passes |
| G2 | `npm run lint` passes with 0 errors and 0 warnings, and `format:check` passes |
| G3 | `npm test`, `test:int` and `test:e2e` are all green |
| G4 | `npm run check:boundaries` is clean (R1–R12) |
| G5 | No R13–R15 violation found in review |

### 19.2 Rubric (100 points)
Score each criterion **full** (fully met), **half** (1–2 isolated slips) or
**zero** (missing or systematic problem). Half points may be fractional, such as 1.5.

**A. Architecture conformance — 25**
| # | Criterion | Pts |
| - | --------- | --- |
| A1 | Folders, file names and class names follow §2 and §10 | 5 |
| A2 | Aggregate pattern exact: private ctor, `create` runs every mutator, `rehydrate`, getters, verb mutators (§6.4) | 6 |
| A3 | Write/read split: repositories return aggregates, queries return ReadModels, injected by Symbol (§7) | 5 |
| A4 | Controllers are thin: only input mapping and the bus, with the §9 endpoint set and route order | 4 |
| A5 | All registrations are complete (§11) | 3 |
| A6 | Model lengths match aggregate constants; `RESTRICT` relations have a `ConflictError` guard | 2 |

**B. Rules & boundaries — 15**
| # | Criterion | Pts |
| - | --------- | --- |
| B1 | Scope: only its own module plus the allowed registration points (§16.3) | 4 |
| B2 | No unflagged breaking API change | 3 |
| B3 | DB changes declared, with manual SQL for existing tables | 3 |
| B4 | Correct error classes and exact message formats (§15.5) | 3 |
| B5 | Swagger complete: `@ApiOperation`, an `@ApiResponse` per status, `@ApiProperty` on every DTO field | 2 |

**C. Coding practices — 20**
| # | Criterion | Pts |
| - | --------- | --- |
| C1 | Type safety: no `any`, explicit return types, justified casts (§15.1) | 4 |
| C2 | Naming, size, readability; no magic values (§15.3) | 4 |
| C3 | Correct `null` / `undefined` semantics (§15.2) | 3 |
| C4 | Persistence practices: `count` for existence, `Number()` on BIGINT, ISO dates, no N+1 (§15.6) | 3 |
| C5 | Import order and alias rules (§15.4) | 2 |
| C6 | No dead or commented-out code, no stray TODOs or console calls (§15.7) | 2 |
| C7 | No unjustified `eslint-disable` (§15.8) | 2 |

**D. Testing — 25**
| # | Criterion | Pts |
| - | --------- | --- |
| D1 | Aggregate tests cover every mutator, including max / max+1 boundaries | 6 |
| D2 | Handler tests cover the happy path and **every** error path (§17.3) | 6 |
| D3 | Integration tests for the repository and queries | 5 |
| D4 | E2E covers all endpoints and every 400/404/409 path | 4 |
| D5 | Coverage thresholds met (§17.1) | 2 |
| D6 | Test quality: AAA, naming, independence, exact error assertions, no mocked domain (§17.4) | 2 |

**E. PR quality — 15**
| # | Criterion | Pts |
| - | --------- | --- |
| E1 | Description complete per the §18.5 template, including the OpenSpec link | 4 |
| E2 | Single concern, within the size limit (§18.3) | 3 |
| E3 | Branch, title and commits follow the conventions (§18.1–18.2) | 3 |
| E4 | Every review comment addressed | 3 |
| E5 | Self-score included and within 10 points of the reviewer's score | 2 |

### 19.3 Category floors
Each category must score **at least 50% of its maximum**: A ≥ 12.5, B ≥ 7.5,
C ≥ 10, D ≥ 12.5, E ≥ 7.5. A PR that misses any floor gets grade **D**,
whatever its total.

### 19.4 Grades
| Score | Grade | Outcome |
| ----- | ----- | ------- |
| 90–100 | **A** | Approve and merge |
| 80–89.5 | **B** | Merge after fixing the noted `minor:` items; no re-review needed |
| 70–79.5 | **C** | Changes requested; re-score after the fixes |
| < 70, or a missed floor | **D** | Rejected; re-plan (update the OpenSpec change) and rework |
| Gate failed | **0** | Blocked until the gate is green |

### 19.5 Scorecard (paste into the PR)
```markdown
### Scorecard — <PR title>
Gate: G1 ✅ G2 ✅ G3 ✅ G4 ✅ G5 ✅

| Category | Score | Notes |
| -------- | ----- | ----- |
| A. Architecture (25)   |    |  |
| B. Boundaries (15)     |    |  |
| C. Coding (20)         |    |  |
| D. Testing (25)        |    |  |
| E. PR quality (15)     |    |  |
| **Total (100)**        |    | Grade: |

Deductions:
- <criterion id> −<pts>: <reason, file:line>
```
