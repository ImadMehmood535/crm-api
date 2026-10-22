---
name: simple-code
description: Write the simplest code that works in crm-developer-api, meaning the fewest moving parts that still follow ARCHITECTURE.md. Use this skill every time you write, change, refactor or review code in this repo, including implementing OpenSpec tasks (openspec-apply-change / opsx:apply), adding a module, slice, handler, repository, controller or test, fixing a bug, or cleaning up. Also use it whenever the user says "simple", "simplest", "keep it simple", "asaan", "seedha", "saada code", "zyada complex mat karo" or "over-engineering mat karo", even if they don't name the skill.
---

# Simple code

The goal is code that a new developer can read top to bottom once and understand,
with nothing in it that the current task doesn't need.

In this repo, "simple" has a fixed meaning: **ARCHITECTURE.md's patterns with
nothing added on top.** The layers, slices, aggregates, Repository/Queries split
and Symbol tokens are the baseline, not the over-engineering. Skipping them
makes the code inconsistent, not simpler, and the hard rules in §16.1 still
apply. The complexity to avoid is everything *beyond* those templates.

## The rules

### 1. Build only what the task asks for
- Implement the requirement in front of you and nothing else. Add no
  "might need it later" options, parameters, flags, hooks or extension points.
- Don't generalise from one case. Wait until the same code exists in three
  places before extracting it. Two similar slices are fine; each slice owning
  its own code is the point of vertical slices.
- Don't add endpoints, fields, filters or sorting that the spec doesn't list.

**Why:** unused flexibility still has to be read, tested and maintained. It is
cheaper to add a feature when it's needed than to carry it until then.

### 2. Copy the template, don't invent
- For every file type (aggregate, model, repository, queries, command, handler,
  request, response, controller), copy the matching example from ARCHITECTURE.md
  and change only the names and fields.
- Don't create generic base classes (`BaseRepository<T>`, `BaseHandler`,
  `CrudController<T>`), mixins, decorators of your own, factories or
  "manager"/"service"/"helper" classes. The only base class is `BaseModel`.
- Don't add libraries. Node built-ins and the §1 allowlist cover everything.

**Why:** when every module looks the same, readers learn the pattern once. A
clever shared abstraction saves lines but forces everyone to learn it.

### 3. Prefer straight-line code
- Use early returns and guard clauses rather than nested `if`/`else`.
- Write a plain `for` loop or one `map`/`filter` rather than chained
  `reduce`/`flatMap` puzzles.
- Use no nested ternaries. One simple ternary is fine.
- Give each function one job, and keep it short enough to see at a glance
  (≤ 30 lines, §15.3).
- Name things plainly so that comments aren't needed: `developerExists`, not `chkDev`.
- Use no metaprogramming: no dynamic property access by string, no `Reflect`,
  no runtime-generated classes.

### 4. Use the smallest diff
- Touch only the files the task needs, plus the registration points in §16.3.
- Don't reformat, rename or "tidy" unrelated code in the same change.
- Never leave dead code, commented-out code or unused imports behind.

### 5. Don't add speculative robustness
- Validate once, in the aggregate via `Guards`. Don't re-validate in the
  controller, handler or repository.
- Don't wrap calls in `try/catch` "just in case". Let errors reach
  `DomainExceptionFilter`.
- Add no caching, batching, retries, queues or parallelism unless the task
  demands it with a measured reason.
- Don't add `null` checks for values the types already guarantee.

### 6. Keep tests simple too
- Write one behaviour per test with Arrange / Act / Assert, using plain data
  built inline or with one small `validProps()` factory.
- Cover the cases §17.3 requires and nothing more. Don't snapshot whole
  objects; assert the fields that matter.
- Don't build test frameworks: no custom matchers, no shared fixture
  hierarchies, no helper that hides what the test does.

## Before you finish: the deletion check

Go through what you wrote and ask, for each piece:

1. **Can I delete it and still meet the requirement?** If yes, delete it.
2. **Is there a simpler construct that does the same thing?** If yes, use it.
3. **Would a new developer understand this without explanation?** If not,
   simplify it or rename things. Add a comment only when the *why* isn't obvious.
4. **Did I add anything that isn't in ARCHITECTURE.md's templates?** If yes,
   remove it, or justify it in one sentence in the PR description.

When you report back, list anything you deliberately left out to keep things
simple, such as "no sorting param, since the spec doesn't ask for one", so the
user can ask for it if they want it.

## Examples

**Over-engineered**
```ts
export abstract class BaseCrudHandler<TAgg, TRepo extends IRepo<TAgg>> {
  protected abstract notFoundMessage(id: number): string;
  async loadOrThrow(repo: TRepo, id: number): Promise<TAgg> {
    const found = await repo.findById(id);
    return found ?? (() => { throw new NotFoundError(this.notFoundMessage(id)); })();
  }
}
```

**Simple (the ARCHITECTURE.md way)**
```ts
const project = await this.projectRepository.findById(organizationId, command.id);
if (!project) throw new NotFoundError();
```

**Over-engineered**
```ts
const where = Object.entries(filter)
  .filter(([k, v]) => v !== undefined && !['page', 'size'].includes(k))
  .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
```

**Simple**
```ts
const conditions: WhereOptions[] = [];
if (filter.status) conditions.push({ status: filter.status });
if (filter.search) conditions.push({ name: { [Op.iLike]: `%${filter.search}%` } });
```

**Speculative**
```ts
@Get()
findAll(@Query('sortBy') sortBy = 'id', @Query('sortDir') sortDir: 'ASC' | 'DESC' = 'DESC') { … }
```

**Simple**: the spec has no sorting, so lists keep the contract's default order (§7.5) and no sort params are added.
