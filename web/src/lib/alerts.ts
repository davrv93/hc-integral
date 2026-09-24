import Swal from 'sweetalert2'

const baseSwal = Swal.mixin({
  customClass: {
    popup: 'rounded-card font-sans',
    confirmButton:
      'inline-flex items-center justify-center min-h-control px-4 rounded-control font-medium text-white bg-danger hover:bg-[#8f2f22] transition-colors mr-2',
    cancelButton:
      'inline-flex items-center justify-center min-h-control px-4 rounded-control font-medium text-text-soft bg-white border border-border hover:bg-bg transition-colors',
  },
  buttonsStyling: false,
})

export async function confirmArchivar(nombre: string): Promise<boolean> {
  const result = await baseSwal.fire({
    icon: 'warning',
    iconColor: '#C27A1A',
    title: 'Archivar historia clínica',
    html: `¿Deseas archivar la historia de <strong>${nombre}</strong>?<br/><span style="color:#5A6B6F;font-size:0.875rem">No se borra de forma definitiva, se puede restaurar desde Auditoría.</span>`,
    showCancelButton: true,
    confirmButtonText: 'Sí, archivar',
    cancelButtonText: 'Cancelar',
    reverseButtons: true,
    focusCancel: true,
  })
  return result.isConfirmed
}

export async function confirmArchivarMultiples(n: number): Promise<boolean> {
  const result = await baseSwal.fire({
    icon: 'warning',
    iconColor: '#C27A1A',
    title: 'Archivar historias clínicas',
    html: `¿Deseas archivar <strong>${n}</strong> historia${n === 1 ? '' : 's'} seleccionada${n === 1 ? '' : 's'}?<br/><span style="color:#5A6B6F;font-size:0.875rem">No se borran de forma definitiva, se pueden restaurar desde Auditoría.</span>`,
    showCancelButton: true,
    confirmButtonText: 'Sí, archivar',
    cancelButtonText: 'Cancelar',
    reverseButtons: true,
    focusCancel: true,
  })
  return result.isConfirmed
}

export async function confirmEliminarAtenciones(n: number): Promise<boolean> {
  const result = await baseSwal.fire({
    icon: 'warning',
    iconColor: '#9E3322',
    title: 'Eliminar atenciones',
    html: `¿Deseas eliminar <strong>${n}</strong> atencion${n === 1 ? '' : 'es'} seleccionada${n === 1 ? '' : 's'}?<br/><span style="color:#5A6B6F;font-size:0.875rem">Esta acción no se puede deshacer.</span>`,
    showCancelButton: true,
    confirmButtonText: n === 1 ? 'Sí, eliminar' : 'Sí, eliminar todas',
    cancelButtonText: 'Cancelar',
    reverseButtons: true,
    focusCancel: true,
  })
  return result.isConfirmed
}

const toastMixin = Swal.mixin({
  toast: true,
  position: 'bottom-end',
  showConfirmButton: false,
  timer: 2600,
  timerProgressBar: false,
  didOpen: (el) => {
    el.style.boxShadow = '0 12px 30px rgba(15,40,38,.14)'
  },
})

export function toastSuccess(message: string) {
  void toastMixin.fire({
    icon: 'success',
    iconColor: '#256B40',
    title: message,
    background: '#E3F1E6',
    color: '#256B40',
    customClass: { popup: 'rounded-card font-sans' },
  })
}

export function toastError(message: string) {
  void toastMixin.fire({
    icon: 'error',
    iconColor: '#9E3322',
    title: message,
    background: '#FBE6E2',
    color: '#9E3322',
    customClass: { popup: 'rounded-card font-sans' },
  })
}

export function toastInfo(message: string) {
  void toastMixin.fire({
    icon: 'info',
    iconColor: '#1B5A86',
    title: message,
    background: '#DDEEF9',
    color: '#1B5A86',
    customClass: { popup: 'rounded-card font-sans' },
  })
}
