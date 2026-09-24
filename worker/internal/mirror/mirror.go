// Package mirror manages the SQLite mirror database that the worker
// maintains as a read-only (for external consumers) copy of the
// `pacientes`, `medicos`, `historias` and `intervenciones` Postgres tables,
// as described in docs/CONTRACT.md section 3.
//
// The worker is the ONLY writer to this database. Anything else (e.g. a
// reporting tool) should open it read-only.
package mirror

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	_ "modernc.org/sqlite"
)

// columnKind describes how a JSON payload value should be coerced before
// being bound to a SQLite column.
type columnKind int

const (
	kindText columnKind = iota
	kindInt
	kindBool
)

type column struct {
	name string
	kind columnKind
}

// schema mirrors the columns of pacientes, medicos, historias and
// intervenciones as defined in migrations/0001_init.sql, minus foreign key
// constraints (this is a simplified read mirror, not a transactional store).
var schema = map[string][]column{
	"pacientes": {
		{"id", kindText},
		{"dni", kindText},
		{"nombres", kindText},
		{"apellidos", kindText},
		{"fecha_nac", kindText},
		{"sexo", kindText},
		{"telefono", kindText},
		{"created_at", kindText},
		{"updated_at", kindText},
	},
	"medicos": {
		{"id", kindText},
		{"nombre", kindText},
		{"titulo", kindText},
		{"especialidad", kindText},
		{"activo", kindBool},
		{"usuario_id", kindText},
		{"created_at", kindText},
	},
	"historias": {
		{"id", kindText},
		{"correlativo", kindInt},
		{"paciente_id", kindText},
		{"medico_id", kindText},
		{"diagnostico", kindText},
		{"plan_trabajo_estado", kindText},
		{"objetivos_estado", kindText},
		{"necesidades", kindText},
		{"objetivos_propuestos", kindText},
		{"plan_actual", kindText},
		{"plazo", kindText},
		{"observaciones", kindText},
		{"estado_revision", kindText},
		{"created_by", kindText},
		{"updated_by", kindText},
		{"created_at", kindText},
		{"updated_at", kindText},
		{"deleted_at", kindText},
	},
	"intervenciones": {
		{"id", kindText},
		{"historia_id", kindText},
		{"disciplina", kindText},
		{"detalle", kindText},
		{"responsable_id", kindText},
		{"updated_at", kindText},
	},
}

// tableOrder fixes the creation order (not semantically important since we
// don't declare foreign keys, but keeps the schema deterministic/readable).
var tableOrder = []string{"pacientes", "medicos", "historias", "intervenciones"}

// Open creates (if needed) the parent directory of path, opens the SQLite
// mirror database, applies the mirror schema (idempotent, CREATE TABLE IF
// NOT EXISTS) and returns the handle.
//
// The returned *sql.DB is configured for a single connection: SQLite only
// supports one writer at a time, and the worker is designed as the sole
// writer applying changes serially, so a single shared connection avoids
// "database is locked" errors without needing an external mutex.
func Open(path string) (*sql.DB, error) {
	if dir := filepath.Dir(path); dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, fmt.Errorf("mirror: create dir %q: %w", dir, err)
		}
	}

	// _pragma sets busy_timeout so concurrent readers (e.g. a `sqlite3`
	// shell inspecting the mirror) don't immediately fail with SQLITE_BUSY
	// while the worker holds a brief write lock.
	dsn := path + "?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("mirror: open %q: %w", path, err)
	}
	db.SetMaxOpenConns(1)

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("mirror: ping: %w", err)
	}

	if err := migrate(db); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func migrate(db *sql.DB) error {
	for _, tabla := range tableOrder {
		cols := schema[tabla]
		defs := make([]string, len(cols))
		for i, c := range cols {
			sqlType := "TEXT"
			switch c.kind {
			case kindInt:
				sqlType = "INTEGER"
			case kindBool:
				sqlType = "INTEGER" // SQLite has no native boolean; 0/1
			}
			if c.name == "id" {
				defs[i] = "id TEXT PRIMARY KEY"
			} else {
				defs[i] = fmt.Sprintf("%s %s", c.name, sqlType)
			}
		}
		stmt := fmt.Sprintf("CREATE TABLE IF NOT EXISTS %s (%s)", tabla, strings.Join(defs, ", "))
		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("mirror: create table %s: %w", tabla, err)
		}
	}
	return nil
}

// Apply applies a single outbox operation (insert/update/delete) to the
// mirror database. `tabla` and `op` come straight from the outbox row;
// `rowID` is the outbox `row_id` column; `payload` is the outbox `payload`
// jsonb column, used as the full new-row state for insert/update. For
// delete, the payload is ignored and the row is removed by id.
func Apply(db *sql.DB, tabla, op, rowID string, payload []byte) error {
	cols, ok := schema[tabla]
	if !ok {
		return fmt.Errorf("mirror: unknown table %q", tabla)
	}

	switch op {
	case "delete":
		_, err := db.Exec(fmt.Sprintf("DELETE FROM %s WHERE id = ?", tabla), rowID)
		if err != nil {
			return fmt.Errorf("mirror: delete %s/%s: %w", tabla, rowID, err)
		}
		return nil

	case "insert", "update":
		if len(payload) == 0 {
			return fmt.Errorf("mirror: %s on %s/%s has empty payload", op, tabla, rowID)
		}
		values, err := decodePayload(payload)
		if err != nil {
			return fmt.Errorf("mirror: decode payload for %s/%s: %w", tabla, rowID, err)
		}

		colNames := make([]string, len(cols))
		placeholders := make([]string, len(cols))
		args := make([]interface{}, len(cols))
		setClauses := make([]string, 0, len(cols)-1)
		for i, c := range cols {
			colNames[i] = c.name
			placeholders[i] = "?"
			args[i] = coerce(c, values[c.name])
			if c.name != "id" {
				setClauses = append(setClauses, fmt.Sprintf("%s = excluded.%s", c.name, c.name))
			}
		}
		// id must come from row_id if not present/consistent in payload,
		// guaranteeing the mirror row is keyed exactly like the outbox
		// entry regardless of payload contents.
		for i, c := range cols {
			if c.name == "id" {
				args[i] = rowID
			}
		}

		query := fmt.Sprintf(
			"INSERT INTO %s (%s) VALUES (%s) ON CONFLICT(id) DO UPDATE SET %s",
			tabla, strings.Join(colNames, ", "), strings.Join(placeholders, ", "), strings.Join(setClauses, ", "),
		)
		if _, err := db.Exec(query, args...); err != nil {
			return fmt.Errorf("mirror: upsert %s/%s: %w", tabla, rowID, err)
		}
		return nil

	default:
		return fmt.Errorf("mirror: unknown op %q for %s/%s", op, tabla, rowID)
	}
}

// decodePayload parses the outbox jsonb payload into a map, preserving
// numbers as json.Number so integer columns don't round-trip through
// float64.
func decodePayload(payload []byte) (map[string]interface{}, error) {
	dec := json.NewDecoder(bytes.NewReader(payload))
	dec.UseNumber()
	var m map[string]interface{}
	if err := dec.Decode(&m); err != nil {
		return nil, err
	}
	return m, nil
}

// coerce converts a decoded JSON value into a type suitable for binding to
// the given SQLite column.
func coerce(c column, v interface{}) interface{} {
	if v == nil {
		return nil
	}
	switch c.kind {
	case kindBool:
		switch t := v.(type) {
		case bool:
			return t
		case json.Number:
			f, _ := t.Float64()
			return f != 0
		case string:
			return t == "t" || t == "true" || t == "1"
		}
		return v
	case kindInt:
		switch t := v.(type) {
		case json.Number:
			if i, err := t.Int64(); err == nil {
				return i
			}
			f, _ := t.Float64()
			return int64(f)
		case float64:
			return int64(t)
		case string:
			return t
		}
		return v
	default: // kindText
		switch t := v.(type) {
		case string:
			return t
		case json.Number:
			return t.String()
		case bool:
			if t {
				return "true"
			}
			return "false"
		default:
			b, _ := json.Marshal(t)
			return string(b)
		}
	}
}

// Tables returns the list of mirrored table names, in a stable order.
func Tables() []string {
	out := make([]string, len(tableOrder))
	copy(out, tableOrder)
	return out
}
