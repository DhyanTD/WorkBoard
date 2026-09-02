# Repository guidance - By Dhyan

## Mandatory repository instructions

- Treat this `AGENTS.md` file as mandatory repository guidance. Read it before
  planning, investigating, or modifying this repository.
- If this file is not available in the current agent context, ask the user to
  provide it or explicitly confirm that work should continue without it.

## Planning and implementation

- Before making any change, generate a concise plan for the work.
- Do not begin implementation merely from inferred intent or surrounding
  context. Start building only when the user directly asks for a change,
  implementation, or build.
- A direct implementation request authorizes execution after the plan is made;
  otherwise, wait for the user's direction before changing files.

## TypeScript

- Do not use `any` or `unknown`. Prefer concrete types, generics, type guards, or
  library-provided types.
- A narrow `catch (error: any)` is allowed only when required to work with an
  existing error-handling boundary. Do not let that `any` escape its catch block.

## Database migrations

- Do not create, edit, rename, register, or delete migrations.
- Migrations are generated and managed exclusively by Dhyan (the user).
- Entity changes may be made when requested, but clearly state the migration
  requirements for Dhyan to handle.

## Documentation

- For every new feature, create or update a short summary in `documentation/`.
  Cover its purpose, API or usage, important behavior, and operational caveats.
- Read relevant existing documentation before changing a feature, and keep its
  summary current when behavior materially changes.
- For Tally Echo upload, normalized data, import-run, upsert, or deletion work,
  read `documentation/TALLY_ECHO_IMPLEMENTATION_SUMMARY.md` first.


## Functions/Components

- If you think the code is getting bulky, consider splitting it into smaller
  functions or components.
- For Functions lets keep the threshold of 30 lines of code.
- For Components lets keep the threshold of 100 lines of code.
