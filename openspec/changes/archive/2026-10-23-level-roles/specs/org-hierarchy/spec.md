## MODIFIED Requirements

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
