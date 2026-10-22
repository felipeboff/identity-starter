# ResolveHub

ResolveHub is a multi-tenant help desk platform built to manage customer support tickets, internal workflows, service-level agreements, notifications, attachments, and support teams.

The project is designed as a backend study project focused on real-world software engineering concepts. Features should be introduced when the domain creates a real need for them instead of adding technologies without a clear purpose.

## What is a Help Desk

A help desk is a system used by companies to organize customer support requests.

Customers can create tickets when they need help, report a problem, request information, or ask for technical support.

Support agents receive these tickets and manage them through a structured workflow until the issue is resolved.

A ticket can contain

- Title
- Description
- Customer
- Assigned agent
- Priority
- Category
- Status
- Comments
- Attachments
- SLA deadlines
- Activity history

A typical ticket workflow could be

```text
OPEN
↓
IN_PROGRESS
↓
WAITING_CUSTOMER
↓
RESOLVED
↓
CLOSED
```

## Main Features

### Authentication

- User registration
- User login
- JWT authentication
- Refresh tokens
- Logout
- Password recovery
- Session management
- Token revocation

### Users

- Create users
- Update users
- Disable users
- User profile
- User roles
- User permissions

### Roles and Permissions

Role-based access control using RBAC.

Initial roles

- Customer
- Agent
- Supervisor
- Administrator

Example permissions

- Customers can access their own tickets
- Agents can access assigned tickets
- Supervisors can manage team tickets
- Administrators can manage the entire organization

### Organizations

The application should support multiple organizations.

Each organization has isolated

- Users
- Customers
- Agents
- Tickets
- Settings
- SLA policies
- Categories

This introduces multi-tenancy concepts.

### Tickets

Users can create support tickets.

Each ticket contains

- Title
- Description
- Status
- Priority
- Customer
- Assigned agent
- Category
- Creation date
- Last update date
- SLA information

Possible statuses

```text
OPEN
IN_PROGRESS
WAITING_CUSTOMER
WAITING_INTERNAL
RESOLVED
CLOSED
```

Possible priorities

```text
LOW
NORMAL
HIGH
URGENT
```

### Ticket Assignment

Tickets can be assigned to support agents.

Possible features

- Manual assignment
- Automatic assignment
- Team assignment
- Agent availability
- Workload balancing

### Comments

Tickets support conversations between customers and support agents.

Comments can be

- Public
- Internal

Internal comments are visible only to the support team.

### Attachments

Users can upload files to tickets and comments.

Files should be stored using Amazon S3.

Possible supported files

- Images
- PDFs
- Documents
- Log files

### Categories

Tickets can be organized into categories.

Examples

```text
TECHNICAL_SUPPORT
BILLING
ACCOUNT
FEATURE_REQUEST
BUG_REPORT
GENERAL
```

### SLA

Service-level agreements define how quickly tickets should receive attention.

Example policy

```text
URGENT

First response within 30 minutes
Resolution within 4 hours
```

The system should monitor SLA deadlines automatically.

Possible actions

- Detect approaching deadlines
- Detect violated deadlines
- Notify agents
- Notify supervisors
- Escalate tickets

### Notifications

Users can receive notifications when important events happen.

Examples

- Ticket created
- Ticket assigned
- New comment
- Status changed
- SLA approaching
- SLA violated
- Ticket resolved

Notification channels can include

- In-app notifications
- Email
- Webhooks

### Background Jobs

Some operations should run asynchronously.

Examples

- Sending emails
- Processing notifications
- Checking SLA deadlines
- Cleaning expired sessions
- Processing attachments
- Generating reports

### Message Queues

Use a message queue for asynchronous operations.

Possible technologies

- Amazon SQS
- RabbitMQ

Example flow

```text
Ticket Created
↓
Event Published
↓
Queue
↓
Notification Worker
↓
Email Sent
```

### Retry

Failed asynchronous operations should support retry strategies.

Examples

- Email provider unavailable
- Webhook destination unavailable
- Temporary network error
- External service timeout

### Dead Letter Queue

Messages that fail repeatedly should be moved to a dead letter queue.

This allows failed operations to be inspected and processed later.

### Webhooks

Organizations can register webhook endpoints.

Example events

```text
ticket.created
ticket.updated
ticket.assigned
ticket.resolved
ticket.closed
comment.created
sla.violated
```

Webhook deliveries should support

- Signatures
- Retry
- Delivery history
- Idempotency
- Failure tracking

### Audit Log

Important actions should generate audit records.

Examples

- User created
- Role changed
- Ticket assigned
- Ticket deleted
- Permission changed
- Organization settings changed

Audit records should contain

- User
- Action
- Resource
- Timestamp
- Previous value
- New value

### Search

Users should be able to search tickets.

Search fields can include

- Ticket ID
- Title
- Description
- Customer
- Agent
- Category

### Filters

Ticket lists should support filters.

Examples

- Status
- Priority
- Agent
- Customer
- Category
- Creation date
- SLA status

### Pagination

Large lists should use pagination.

Possible approaches

- Offset pagination
- Cursor pagination

Cursor pagination should be preferred for large datasets.

### Sorting

Ticket lists can support sorting by

- Creation date
- Last update
- Priority
- SLA deadline

### Reports

Organizations can access support metrics.

Examples

- Tickets created
- Tickets resolved
- Average response time
- Average resolution time
- SLA violations
- Tickets per agent
- Tickets per category

### Rate Limiting

Rate limiting should protect public endpoints.

Examples

- Login
- Password recovery
- Ticket creation
- Webhook endpoints

Redis can be used to store rate-limit counters.

### Cache

Redis can be used for frequently accessed data.

Possible cached resources

- Organization settings
- User permissions
- Categories
- SLA policies

The project should also explore cache invalidation strategies.

### Distributed Locking

Distributed locks can be introduced for operations where multiple workers could process the same resource simultaneously.

Possible examples

- SLA processing
- Report generation
- Scheduled jobs

### Transactions

Database transactions should protect operations that modify multiple related resources.

Example

```text
Create Ticket
↓
Create Initial Activity
↓
Create SLA Record
↓
Publish Domain Event
```

The operation should either complete entirely or fail entirely when required.

### Concurrency

The project should explore concurrent operations.

Possible scenarios

- Two agents assigning the same ticket
- Two users updating the same ticket
- Multiple workers processing the same job
- Ticket status changing while another operation is running

Possible techniques

- Optimistic locking
- Transactions
- Atomic updates
- Distributed locks

### Idempotency

Some endpoints should support idempotency.

Possible examples

- Ticket creation
- Webhook processing
- External API callbacks
- Background jobs

The same request should not accidentally create duplicated operations.

## Backend Architecture

The backend should separate responsibilities between different layers.

Example structure

```text
src/

domain/
application/
infrastructure/
interfaces/
shared/
```

Possible responsibilities

### Domain

- Entities
- Value objects
- Domain rules
- Domain errors
- Domain events

### Application

- Use cases
- Application services
- Ports
- DTOs
- Validation

### Infrastructure

- Database
- Repositories
- Redis
- Queues
- Email providers
- AWS services
- External integrations

### Interfaces

- HTTP controllers
- Routes
- Middlewares
- Request validation
- Response mapping

## Technologies

### Runtime

- Node.js
- TypeScript

### API

- REST API

Possible framework options

- Express
- Fastify
- NestJS

### Database

Possible options

- PostgreSQL
- MongoDB

PostgreSQL is recommended for exploring relational modeling, transactions, constraints, and concurrency.

### Cache

- Redis

Redis can be used for

- Cache
- Rate limiting
- Sessions
- Distributed locks
- Temporary data

### Message Queue

Possible options

- Amazon SQS
- RabbitMQ

### Object Storage

- Amazon S3

Used for

- Ticket attachments
- Images
- Documents

### Authentication

- JWT
- Refresh tokens

### Authorization

- RBAC

### Validation

- Zod

Or a custom validation library for studying validation architecture.

### Containers

- Docker
- Docker Compose

### Cloud

- AWS

Possible services

- EC2
- ECS
- API Gateway
- S3
- SQS
- CloudWatch
- ElastiCache

### CI and CD

- GitHub Actions

Possible pipeline

```text
Push
↓
Lint
↓
Type Check
↓
Tests
↓
Build
↓
Docker Image
↓
Deploy
```

## Testing

### Unit Tests

Test isolated business rules.

Examples

- Ticket assignment rules
- SLA calculation
- Permission validation
- Status transitions

### Integration Tests

Test integrations between components.

Examples

- API and database
- Repository implementations
- Redis
- Queue producers
- Queue consumers

### End-to-End Tests

Test complete user flows.

Example

```text
Customer creates ticket
↓
Agent receives ticket
↓
Agent responds
↓
Customer replies
↓
Agent resolves ticket
```

## Observability

The application should include proper observability.

### Structured Logs

Logs should contain structured information.

Examples

- Request ID
- User ID
- Organization ID
- Ticket ID
- Service
- Operation

### Metrics

Possible metrics

- Request duration
- Error rate
- Queue size
- Processing time
- Tickets created
- Tickets resolved
- SLA violations

### Distributed Tracing

Tracing can be used to follow operations across multiple components.

Example

```text
HTTP Request
↓
API
↓
Database
↓
Queue
↓
Worker
↓
Email Provider
```

### Monitoring

Possible tools

- AWS CloudWatch
- OpenTelemetry

## Database Concepts

The project should explore

- Indexes
- Unique constraints
- Transactions
- Foreign keys
- Query optimization
- Pagination
- Database migrations
- Optimistic locking

## Security

The project should implement

- Password hashing
- JWT validation
- Refresh token rotation
- RBAC
- Rate limiting
- Request validation
- Secure headers
- CORS configuration
- File validation
- Audit logs
- Webhook signatures

## Concepts to Study

ResolveHub should be used to practice

- REST APIs
- Authentication
- Authorization
- RBAC
- Multi-tenancy
- Domain modeling
- Clean Architecture
- Dependency inversion
- Repository pattern
- Transactions
- Concurrency
- Race conditions
- Optimistic locking
- Idempotency
- Message queues
- Background jobs
- Retry strategies
- Dead letter queues
- Webhooks
- Event-driven architecture
- Cache
- Cache invalidation
- Distributed locking
- Pagination
- Filtering
- Sorting
- Database indexing
- Logging
- Metrics
- Distributed tracing
- Error handling
- Validation
- Testing
- Docker
- CI and CD
- Cloud infrastructure
- Observability

## Development Philosophy

Do not add technology only because it is popular or available.

Start with the simplest implementation.

Introduce new infrastructure when the application creates a problem that requires it.

Examples

```text
Need asynchronous email delivery
→ Introduce a queue

Repeated expensive queries
→ Introduce cache

Multiple workers processing the same resource
→ Study distributed locking

Duplicate external requests
→ Introduce idempotency

Slow database queries
→ Study indexes and query optimization

Need to understand failures across services
→ Introduce distributed tracing
```

The objective of ResolveHub is not only to build a working help desk.

The objective is to understand why backend systems evolve and which problems each architectural concept or technology solves.
