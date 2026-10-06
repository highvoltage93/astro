#!/usr/bin/env bash
set -Eeuo pipefail

# Only runs for an empty PostgreSQL volume; password changes later require ALTER ROLE.
psql --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=app_password="$APP_DB_PASSWORD" --set=backup_password="$BACKUP_DB_PASSWORD" <<'SQL'
CREATE ROLE astro_app LOGIN PASSWORD :'app_password';
CREATE ROLE astro_backup LOGIN PASSWORD :'backup_password';
REVOKE ALL ON DATABASE astroprocessor FROM PUBLIC;
GRANT CONNECT ON DATABASE astroprocessor TO astro_app, astro_backup;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO astro_app, astro_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE astro_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO astro_app;
ALTER DEFAULT PRIVILEGES FOR ROLE astro_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO astro_app;
GRANT pg_read_all_data TO astro_backup;
SQL
