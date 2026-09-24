package mirror

import (
	"database/sql"
	"path/filepath"
	"testing"
)

func openTestMirror(t *testing.T) *sql.DB {
	t.Helper()
	dir := t.TempDir()
	db, err := Open(filepath.Join(dir, "mirror.sqlite"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func TestApplyInsertAndUpdateMedico(t *testing.T) {
	db := openTestMirror(t)

	insertPayload := []byte(`{
		"id": "11111111-1111-1111-1111-111111111111",
		"nombre": "DR. ABRIL",
		"titulo": "DR.",
		"especialidad": "Medicina General",
		"activo": true,
		"usuario_id": "22222222-2222-2222-2222-222222222222",
		"created_at": "2026-01-01T00:00:00Z"
	}`)
	if err := Apply(db, "medicos", "insert", "11111111-1111-1111-1111-111111111111", insertPayload); err != nil {
		t.Fatalf("insert apply: %v", err)
	}

	var nombre, especialidad string
	var activo bool
	if err := db.QueryRow(`SELECT nombre, especialidad, activo FROM medicos WHERE id = ?`,
		"11111111-1111-1111-1111-111111111111").Scan(&nombre, &especialidad, &activo); err != nil {
		t.Fatalf("query after insert: %v", err)
	}
	if nombre != "DR. ABRIL" || especialidad != "Medicina General" || activo != true {
		t.Fatalf("unexpected row after insert: nombre=%q especialidad=%q activo=%v", nombre, especialidad, activo)
	}

	// update op with same row_id, changed fields via UPSERT
	updatePayload := []byte(`{
		"id": "11111111-1111-1111-1111-111111111111",
		"nombre": "DR. ABRIL",
		"titulo": "DR.",
		"especialidad": "Cardiologia",
		"activo": false,
		"usuario_id": "22222222-2222-2222-2222-222222222222",
		"created_at": "2026-01-01T00:00:00Z"
	}`)
	if err := Apply(db, "medicos", "update", "11111111-1111-1111-1111-111111111111", updatePayload); err != nil {
		t.Fatalf("update apply: %v", err)
	}

	if err := db.QueryRow(`SELECT nombre, especialidad, activo FROM medicos WHERE id = ?`,
		"11111111-1111-1111-1111-111111111111").Scan(&nombre, &especialidad, &activo); err != nil {
		t.Fatalf("query after update: %v", err)
	}
	if especialidad != "Cardiologia" || activo != false {
		t.Fatalf("unexpected row after update: especialidad=%q activo=%v", especialidad, activo)
	}

	var count int
	if err := db.QueryRow(`SELECT count(*) FROM medicos`).Scan(&count); err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected upsert to keep exactly 1 row, got %d", count)
	}
}

func TestApplyDelete(t *testing.T) {
	db := openTestMirror(t)

	payload := []byte(`{
		"id": "33333333-3333-3333-3333-333333333333",
		"dni": "12345678",
		"nombres": "Juan",
		"apellidos": "Perez",
		"fecha_nac": "1990-01-01",
		"sexo": "M",
		"telefono": "999999999",
		"created_at": "2026-01-01T00:00:00Z",
		"updated_at": "2026-01-01T00:00:00Z"
	}`)
	if err := Apply(db, "pacientes", "insert", "33333333-3333-3333-3333-333333333333", payload); err != nil {
		t.Fatalf("insert apply: %v", err)
	}

	var count int
	if err := db.QueryRow(`SELECT count(*) FROM pacientes`).Scan(&count); err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 row before delete, got %d", count)
	}

	// delete: payload is whatever to_jsonb(OLD) produced, but Apply must
	// ignore its contents and delete purely by row_id.
	if err := Apply(db, "pacientes", "delete", "33333333-3333-3333-3333-333333333333", payload); err != nil {
		t.Fatalf("delete apply: %v", err)
	}

	if err := db.QueryRow(`SELECT count(*) FROM pacientes`).Scan(&count); err != nil {
		t.Fatalf("count after delete: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected 0 rows after delete, got %d", count)
	}
}

func TestApplyHistoriaIntegerAndNullColumns(t *testing.T) {
	db := openTestMirror(t)

	payload := []byte(`{
		"id": "44444444-4444-4444-4444-444444444444",
		"correlativo": 42,
		"paciente_id": "33333333-3333-3333-3333-333333333333",
		"medico_id": "11111111-1111-1111-1111-111111111111",
		"diagnostico": "Diagnostico de prueba",
		"plan_trabajo_estado": "SI",
		"objetivos_estado": null,
		"necesidades": null,
		"objetivos_propuestos": null,
		"plan_actual": null,
		"plazo": null,
		"observaciones": null,
		"estado_revision": "en_revision",
		"created_by": null,
		"updated_by": null,
		"created_at": "2026-01-01T00:00:00Z",
		"updated_at": "2026-01-01T00:00:00Z",
		"deleted_at": null
	}`)
	if err := Apply(db, "historias", "insert", "44444444-4444-4444-4444-444444444444", payload); err != nil {
		t.Fatalf("insert apply: %v", err)
	}

	var correlativo int64
	var objetivosEstado sql.NullString
	if err := db.QueryRow(`SELECT correlativo, objetivos_estado FROM historias WHERE id = ?`,
		"44444444-4444-4444-4444-444444444444").Scan(&correlativo, &objetivosEstado); err != nil {
		t.Fatalf("query: %v", err)
	}
	if correlativo != 42 {
		t.Fatalf("expected correlativo=42, got %d", correlativo)
	}
	if objetivosEstado.Valid {
		t.Fatalf("expected objetivos_estado to be NULL, got %q", objetivosEstado.String)
	}
}

func TestApplyUnknownTable(t *testing.T) {
	db := openTestMirror(t)
	if err := Apply(db, "no_existe", "insert", "1", []byte(`{}`)); err == nil {
		t.Fatalf("expected error for unknown table")
	}
}

func TestApplyUnknownOp(t *testing.T) {
	db := openTestMirror(t)
	if err := Apply(db, "medicos", "truncate", "1", []byte(`{}`)); err == nil {
		t.Fatalf("expected error for unknown op")
	}
}
