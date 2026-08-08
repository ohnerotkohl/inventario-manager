export type Talla = 'A4' | 'A3'

export interface Serie {
  id: string
  nombre: string
  color: string
}

export interface Poster {
  id: string
  serie_id: string
  nombre: string
  tiene_a4: boolean
  tiene_a3: boolean
  activo: boolean
  series?: Serie
}

export interface Caja {
  id: string
  nombre: string
  descripcion: string
}

export interface Mercado {
  id: string
  nombre: string
  dia_semana: string
  caja_id: string
  costo_stand?: number
  contabilidad?: 'negocio' | 'marcello' | 'nuria'
  responsable?: string | null
  cajas?: Caja
}

export interface GastoBalance {
  nombre: string
  monto: number
  efectivo: boolean
}

export interface Balance {
  id: string
  mercado_id: string | null
  mercado_nombre: string
  fecha: string
  trabajador: string
  turno_tipo: 'na' | 'horas'
  turno_horas: number
  turno_tarifa: number
  turno_costo: number
  float_inicial: number
  venta_sumup: number
  venta_efectivo: number
  venta_paypal: number
  iva_aplicado: boolean
  iva_monto: number
  gastos: GastoBalance[]
  total_gastos: number
  total_ventas: number
  neto: number
  email_enviado: boolean
  created_at: string
}

export interface Inventario {
  id: string
  caja_id: string
  poster_id: string
  talla: Talla
  cantidad: number
  out: boolean
  sample_falta: boolean
  updated_at: string
  posters?: Poster & { series?: Serie }
}

export interface Sesion {
  id: string
  mercado_id: string
  fecha: string
  trabajador: string
  created_at: string
  mercados?: Mercado
}

export interface Venta {
  id: string
  sesion_id: string
  poster_id: string
  talla: Talla
  cantidad: number
  posters?: Poster
}

export interface MaterialCaja {
  id: string
  caja_id: string
  nombre: string
  necesita_restock: boolean
  cajas?: Caja
}

export interface InsumoEstudio {
  id: string
  nombre: string
  cantidad: number
  unidad: string
  stock_minimo: number
  necesita_compra: boolean
}
