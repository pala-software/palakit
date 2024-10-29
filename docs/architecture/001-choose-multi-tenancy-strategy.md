# Choose Strategy for Supporting Multi-Tenancy

## Status

Decided

## Context

What is the issue that we're seeing that is motivating this decision or change?

- Serve multiple customers without requiring separate instances of applications
  to reduce server cost and ease maintenance of services.
- Ease of tenant administration: easy to create, delete.
- Enable retail network of a product to manage their customers.
- Self-registration for SaaS products.
- Allow users to manage multiple resources under their account. Such as
  websites.

## Decision

What is the change that we're proposing and/or doing?

Options:

- Let application developers implement their own solutions.
- Create separate or core library to extend Pala Kit to support multi-tenancy.
- Pala Kit first-class support. Every part takes into account multi-tenancy.
- **Create separate template project for SaaS products.** (chosen)

We want to have multi-tenancy as a feature of the framework to attract users. So
delegating the development to application developer is not an option it that
case.

We want the framework to be as extensible as possible, so tying a concept of
multi-tenancy as first-class citizen to every part would mean that framework
wouldn't be as extensible by default.

Core library to extend Pala Kit to support multi-tenancy would be an ideal
option based on motivation. But Pala Kit might become more use-case oriented
(eg. SaaS framework) which might make other use cases harder to implement.

Because there's different use cases for multi-tenancy and we don't want to
enforce one way of doing it, it should be tackled in a template instead of core
library.

## Consequences

What becomes easier or more difficult to do because of this change?

- It becomes easier to focus on implementation of multi-tenancy when
  implementations are separated into templates by use case.
- Keeping projects up to date with template is hard or impossible, so some
  template features could become outdated as framework develops.
