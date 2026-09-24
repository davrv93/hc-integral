-- HC Integral — esquema inicial (PostgreSQL 15+)
-- Requiere: pg_trgm, unaccent, pgcrypto (gen_random_uuid)

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE eval_estado AS ENUM ('SI', 'NO', 'PARCIAL');
CREATE TYPE estado_revision AS ENUM ('en_revision', 'requiere_propuesta', 'completo');
CREATE TYPE rol_usuario AS ENUM ('admin', 'medico', 'psicologia', 'terapia_fisica', 'nutricion', 'revisor');
CREATE TYPE disciplina_tipo AS ENUM ('medicina', 'psicologia', 'terapia_fisica', 'nutricion');

-- Función inmutable para búsqueda sin tildes
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text AS $$
  SELECT unaccent('unaccent', $1)
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

CREATE TABLE usuarios (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         citext UNIQUE NOT NULL,
    nombre        text NOT NULL,
    password_hash text NOT NULL,
    rol           rol_usuario NOT NULL,
    activo        boolean NOT NULL DEFAULT true,
    failed_logins int NOT NULL DEFAULT 0,
    locked_until  timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE medicos (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre       text NOT NULL,
    titulo       text NOT NULL DEFAULT 'DR.',
    especialidad text,
    activo       boolean NOT NULL DEFAULT true,
    usuario_id   uuid REFERENCES usuarios(id),
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pacientes (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dni         varchar(15) UNIQUE NOT NULL,
    nombres     text NOT NULL,
    apellidos   text NOT NULL,
    fecha_nac   date,
    sexo        varchar(1),
    telefono    text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pacientes_busqueda_idx ON pacientes USING gin (
    f_unaccent(lower(nombres || ' ' || apellidos || ' ' || dni)) gin_trgm_ops
);

CREATE TABLE historias (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    correlativo          serial UNIQUE,
    paciente_id          uuid NOT NULL REFERENCES pacientes(id),
    medico_id            uuid NOT NULL REFERENCES medicos(id),
    diagnostico          text NOT NULL,
    plan_trabajo_estado  eval_estado,
    objetivos_estado     eval_estado,
    necesidades          text,
    objetivos_propuestos text,
    plan_actual          text,
    plazo                date,
    observaciones        text,
    estado_revision      estado_revision NOT NULL DEFAULT 'en_revision',
    created_by           uuid REFERENCES usuarios(id),
    updated_by           uuid REFERENCES usuarios(id),
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),
    deleted_at           timestamptz
);
CREATE INDEX historias_paciente_idx ON historias(paciente_id) WHERE deleted_at IS NULL;
CREATE INDEX historias_medico_idx ON historias(medico_id) WHERE deleted_at IS NULL;
CREATE INDEX historias_estado_idx ON historias(estado_revision) WHERE deleted_at IS NULL;
CREATE INDEX historias_plazo_idx ON historias(plazo) WHERE deleted_at IS NULL;
CREATE INDEX historias_diag_trgm_idx ON historias USING gin (f_unaccent(lower(diagnostico)) gin_trgm_ops);

CREATE TABLE intervenciones (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    historia_id    uuid NOT NULL REFERENCES historias(id) ON DELETE CASCADE,
    disciplina     disciplina_tipo NOT NULL,
    detalle        text NOT NULL DEFAULT '',
    responsable_id uuid REFERENCES usuarios(id),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (historia_id, disciplina)
);

CREATE TABLE auditoria (
    id         bigserial PRIMARY KEY,
    usuario_id uuid REFERENCES usuarios(id),
    accion     text NOT NULL,       -- create | update | delete | login | login_failed
    entidad    text NOT NULL,       -- historias | pacientes | intervenciones | ...
    entidad_id text,
    antes      jsonb,
    despues    jsonb,
    ip         text,
    ts         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auditoria_entidad_idx ON auditoria(entidad, entidad_id);

-- Outbox: alimenta el espejo SQLite (worker/)
CREATE TABLE outbox (
    id        bigserial PRIMARY KEY,
    tabla     text NOT NULL,
    op        text NOT NULL,   -- insert | update | delete
    row_id    text NOT NULL,
    payload   jsonb,
    procesado boolean NOT NULL DEFAULT false,
    ts        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outbox_pendientes_idx ON outbox(id) WHERE procesado = false;

CREATE OR REPLACE FUNCTION fn_outbox() RETURNS trigger AS $$
DECLARE
    v_row_id text;
    v_payload jsonb;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_row_id := OLD.id::text;
        v_payload := to_jsonb(OLD);
    ELSE
        v_row_id := NEW.id::text;
        v_payload := to_jsonb(NEW);
    END IF;
    INSERT INTO outbox(tabla, op, row_id, payload) VALUES (TG_TABLE_NAME, lower(TG_OP), v_row_id, v_payload);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_outbox_pacientes AFTER INSERT OR UPDATE OR DELETE ON pacientes
    FOR EACH ROW EXECUTE FUNCTION fn_outbox();
CREATE TRIGGER trg_outbox_medicos AFTER INSERT OR UPDATE OR DELETE ON medicos
    FOR EACH ROW EXECUTE FUNCTION fn_outbox();
CREATE TRIGGER trg_outbox_historias AFTER INSERT OR UPDATE OR DELETE ON historias
    FOR EACH ROW EXECUTE FUNCTION fn_outbox();
CREATE TRIGGER trg_outbox_intervenciones AFTER INSERT OR UPDATE OR DELETE ON intervenciones
    FOR EACH ROW EXECUTE FUNCTION fn_outbox();

-- OAuth2 (auth-service)
CREATE TABLE oauth_clients (
    client_id     text PRIMARY KEY,
    redirect_uris text[] NOT NULL,
    is_public     boolean NOT NULL DEFAULT true
);

CREATE TABLE oauth_codes (
    code                  text PRIMARY KEY,
    client_id             text NOT NULL REFERENCES oauth_clients(client_id),
    usuario_id            uuid NOT NULL REFERENCES usuarios(id),
    redirect_uri          text NOT NULL,
    code_challenge        text NOT NULL,
    code_challenge_method text NOT NULL DEFAULT 'S256',
    expires_at            timestamptz NOT NULL,
    used                  boolean NOT NULL DEFAULT false,
    created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
    token_hash text PRIMARY KEY,
    usuario_id uuid NOT NULL REFERENCES usuarios(id),
    client_id  text NOT NULL REFERENCES oauth_clients(client_id),
    family_id  uuid NOT NULL,
    revoked    boolean NOT NULL DEFAULT false,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_family_idx ON refresh_tokens(family_id);

-- Seed mínimo para desarrollo (password: "Clave123!" con argon2id — generado por el auth-service en seed.go)
INSERT INTO oauth_clients (client_id, redirect_uris, is_public)
VALUES ('hc-web', ARRAY['http://localhost:5173/callback'], true);
