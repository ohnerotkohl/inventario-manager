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
  cajas?: Caja
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
