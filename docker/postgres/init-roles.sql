-- PostgreSQL Role Initialization for Multi-Tenant CRM
-- Executed on fresh database initialization

CREATE ROLE crm_system_user WITH LOGIN PASSWORD 'local_system_secret';
CREATE ROLE crm_app_user WITH LOGIN PASSWORD 'local_app_secret';
CREATE ROLE crm_maintenance WITH LOGIN PASSWORD 'local_maintenance_secret';
CREATE ROLE crm_migrator WITH LOGIN PASSWORD 'local_migrator_secret';

-- Hardening attributes
ALTER ROLE crm_app_user NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
ALTER ROLE crm_system_user NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
ALTER ROLE crm_maintenance NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
ALTER ROLE crm_migrator CREATEDB NOCREATEROLE;

-- Schema setup
GRANT USAGE ON SCHEMA public TO crm_app_user, crm_system_user, crm_maintenance, crm_migrator;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, crm_app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE crm_migrator IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, crm_app_user;
