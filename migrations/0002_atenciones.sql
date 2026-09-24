CREATE TABLE IF NOT EXISTS atenciones (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    historia_id          uuid NOT NULL REFERENCES historias(id) ON DELETE CASCADE,
    disciplina           disciplina_tipo NOT NULL,
    fecha                timestamptz NOT NULL DEFAULT now(),
    motivo               text NOT NULL DEFAULT '',
    detalle              text NOT NULL DEFAULT '',
    plan_trabajo_estado  eval_estado,
    objetivos_estado     eval_estado,
    necesidades          text,
    objetivos_propuestos text,
    plan_actual          text,
    observaciones        text,
    responsable_id       uuid REFERENCES usuarios(id),
    created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS atenciones_historia_fecha_idx ON atenciones(historia_id, fecha DESC);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_outbox_atenciones'
    ) THEN
        CREATE TRIGGER trg_outbox_atenciones AFTER INSERT OR UPDATE OR DELETE ON atenciones
            FOR EACH ROW EXECUTE FUNCTION fn_outbox();
    END IF;
END;
$$;
