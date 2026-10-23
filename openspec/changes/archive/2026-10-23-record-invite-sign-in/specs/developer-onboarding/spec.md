## ADDED Requirements

### Requirement: Invite acceptance counts as a sign-in
When an invite is accepted, the API SHALL record the new owner's sign-in time (`lastLoginAt`), as a normal login does, because accepting signs them in.

#### Scenario: Owner list after accepting
- **WHEN** an invitee accepts the invite and the owner lists users
- **THEN** the owner's `lastLoginAt` is set, not null
