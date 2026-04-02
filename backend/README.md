# Backend MySQL + Sequelize Migration Guide

This backend now includes a full MySQL + Sequelize migration path while preserving existing application behavior.

## 1) Install dependencies

From repository root:

```bash
npm install
```

## 2) Configure environment

Copy:

```bash
cp backend/.env.example backend/.env
```

Set MySQL connection values:

- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`

If you are migrating existing Mongo data, also set:

- `MONGO_URI` (or `Mongo_atlas`)

## 3) Create MySQL schema with Sequelize migrations

```bash
npm run db:migrate:mysql
```

## 4) Seed baseline system data (roles/permissions)

```bash
npm run db:seed:mysql
```

## 5) Migrate data from MongoDB to MySQL

```bash
npm run db:migrate:data
```

The data migration script:

- connects to MongoDB and MySQL
- copies data in dependency order
- maps legacy Mongo `_id` values to relational foreign keys
- normalizes arrays/nested structures into relational child tables
- runs inside a transaction for rollback safety

## 6) Start the backend

```bash
npm run start
```

## Rollback / reset

```bash
npm run db:reset:mysql
```

## Production cutover notes

1. Run migrations and seeders in production first.
2. Run Mongo→MySQL data migration during controlled window.
3. Compare counts and critical business reports between Mongo and MySQL.
4. Switch backend runtime to MySQL.
5. Keep Mongo snapshot backup for rollback until verification is complete.
