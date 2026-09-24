package apiserver

import "testing"

func validCreatePacienteRequest() createPacienteRequest {
	fechaNac := "1990-04-12"
	sexo := "F"
	return createPacienteRequest{
		DNI:       "12345678",
		Nombres:   "Ana",
		Apellidos: "Pérez",
		FechaNac:  &fechaNac,
		Sexo:      &sexo,
	}
}

func TestValidateCreatePacienteRequest(t *testing.T) {
	tests := []struct {
		name string
		edit func(*createPacienteRequest)
		want string
	}{
		{
			name: "valid required fields",
		},
		{
			name: "missing birth date",
			edit: func(req *createPacienteRequest) { req.FechaNac = nil },
			want: "fecha_nac is required",
		},
		{
			name: "invalid birth date",
			edit: func(req *createPacienteRequest) {
				fechaNac := "12/04/1990"
				req.FechaNac = &fechaNac
			},
			want: "fecha_nac must use YYYY-MM-DD format",
		},
		{
			name: "missing sex",
			edit: func(req *createPacienteRequest) { req.Sexo = nil },
			want: "sexo is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := validCreatePacienteRequest()
			if tt.edit != nil {
				tt.edit(&req)
			}

			err := validateCreatePacienteRequest(req)
			if tt.want == "" {
				if err != nil {
					t.Fatalf("validateCreatePacienteRequest() error = %v, want nil", err)
				}
				return
			}
			if err == nil || err.Error() != tt.want {
				t.Fatalf("validateCreatePacienteRequest() error = %v, want %q", err, tt.want)
			}
		})
	}
}
