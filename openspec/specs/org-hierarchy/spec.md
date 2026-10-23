# org-hierarchy Specification

## Purpose
Organises a company's people into levels (owner, admin, department head, member). The level decides
who may create whom and who may see whom, while roles and permissions keep deciding what each user
may do.

## Requirements

### Requirement: User levels
Every tenant user SHALL have a `level`: `owner`, `admin`, `department_head` or `member`. The company
owner is `owner`, and new users default to `member`. `AuthUser` and `TenantUser` include `level`;
platform users have `level: null`.

#### Scenario: Owner level
- **WHEN** a company owner signs in
- **THEN** `user.level` is `owner`

### Requirement: Who may create which level
Creating a user with a level, or changing a user's level, SHALL be allowed only when the caller's
level may create that level:
- an owner may create `admin`, `department_head` or `member`;
- an admin may create `department_head` or `member`;
- a department head may create `member`;
- a member may create no user.
Otherwise the API answers 403 `FORBIDDEN_OPERATION`. Nobody can create or assign `owner`. Changing a
user's level also requires that the caller may create the user's current level.

#### Scenario: Admin creates a department head
- **WHEN** an admin holding `users.create` creates a user with `level: "department_head"`
- **THEN** the API answers 201 with `level: "department_head"`

#### Scenario: Admin cannot create an admin
- **WHEN** an admin creates a user with `level: "admin"`
- **THEN** the API answers 403 `FORBIDDEN_OPERATION`

#### Scenario: Member cannot create
- **WHEN** a member holding `users.create` creates any user
- **THEN** the API answers 403 `FORBIDDEN_OPERATION`

### Requirement: Who sees whom
User listings, user detail and user management actions SHALL be limited to the users the caller
may see; a user the caller may not see is 404 `NOT_FOUND`. The owner and every admin see every user
of the company. Admins still cannot manage the owner.

#### Scenario: Owner sees all
- **WHEN** the owner lists users
- **THEN** every user of the company is listed

#### Scenario: Admin sees the whole company
- **WHEN** the owner created department head D directly and an admin lists users
- **THEN** D is in the admin's list, together with every other user of the company

### Requirement: Department heads and members see their own people
A department head SHALL see themselves, the members of the teams of the departments they head, and
the users they created (directly or through others). A member SHALL see themselves and the members
of their teams.

#### Scenario: Head sees their departments' people
- **WHEN** head H heads "Finance", whose team has member M, and H lists users
- **THEN** H and M are listed

#### Scenario: Admins see each other's people
- **WHEN** admin A created head H, H created member M, and admin B lists users
- **THEN** the list contains A, B, H and M

#### Scenario: Owner's direct branch hidden from admins
- **WHEN** the owner created department head D directly and an admin lists users
- **THEN** D is not in the admin's list, and `GET /users/{D}` answers 404

#### Scenario: Team member sees teammates
- **WHEN** member M is in team T with members X and Y and M lists users
- **THEN** the list is exactly M, X and Y
