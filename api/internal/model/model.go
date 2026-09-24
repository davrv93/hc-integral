// Package model holds shared data-transfer types used across the API.
package model

import "time"

type Paciente struct {
	ID        string    `json:"id"`
	DNI       string    `json:"dni"`
	Nombres   string    `json:"nombres"`
	Apellidos string    `json:"apellidos"`
	FechaNac  *string   `json:"fecha_nac,omitempty"`
	Sexo      *string   `json:"sexo,omitempty"`
	Telefono  *string   `json:"telefono,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Medico struct {
	ID           string  `json:"id"`
	Nombre       string  `json:"nombre"`
	Titulo       string  `json:"titulo"`
	Especialidad *string `json:"especialidad,omitempty"`
	Activo       bool    `json:"activo"`
}

type Intervencion struct {
	ID            string    `json:"id"`
	HistoriaID    string    `json:"historia_id"`
	Disciplina    string    `json:"disciplina"`
	Detalle       string    `json:"detalle"`
	ResponsableID *string   `json:"responsable_id,omitempty"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type Historia struct {
	ID                  string    `json:"id"`
	Correlativo         int       `json:"correlativo"`
	PacienteID          string    `json:"paciente_id"`
	MedicoID            string    `json:"medico_id"`
	Diagnostico         string    `json:"diagnostico"`
	PlanTrabajoEstado   *string   `json:"plan_trabajo_estado"`
	ObjetivosEstado     *string   `json:"objetivos_estado"`
	Necesidades         *string   `json:"necesidades,omitempty"`
	ObjetivosPropuestos *string   `json:"objetivos_propuestos,omitempty"`
	PlanActual          *string   `json:"plan_actual,omitempty"`
	Plazo               *string   `json:"plazo,omitempty"`
	Observaciones       *string   `json:"observaciones,omitempty"`
	EstadoRevision      string    `json:"estado_revision"`
	CreatedBy           *string   `json:"created_by,omitempty"`
	UpdatedBy           *string   `json:"updated_by,omitempty"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
	DeletedAt           *string   `json:"deleted_at,omitempty"`

	// Optional expansions, populated only where the contract requests them.
	Paciente       *Paciente      `json:"paciente,omitempty"`
	Medico         *Medico        `json:"medico,omitempty"`
	Intervenciones []Intervencion `json:"intervenciones,omitempty"`
	// Convenience fields for list views (not part of the base table).
	PacienteNombre *string `json:"paciente_nombre,omitempty"`
	PacienteDNI    *string `json:"paciente_dni,omitempty"`
	MedicoNombre   *string `json:"medico_nombre,omitempty"`
}

type Auditoria struct {
	ID        int64     `json:"id"`
	UsuarioID *string   `json:"usuario_id,omitempty"`
	Accion    string    `json:"accion"`
	Entidad   string    `json:"entidad"`
	EntidadID *string   `json:"entidad_id,omitempty"`
	Antes     any       `json:"antes,omitempty"`
	Despues   any       `json:"despues,omitempty"`
	IP        *string   `json:"ip,omitempty"`
	TS        time.Time `json:"ts"`
}
