/**
 * Module contract for the Teoverse study workspace.
 * All study resources (Bible versions, Strong dictionary, commentary, notes…)
 * MUST conform to this contract. Presentation-agnostic: no layout, pixel, or
 * shell-specific fields are allowed here.
 *
 * Attribution: all module output carries CC BY 4.0-compatible metadata via
 * the `Atribucion` shape.
 */

// ---------------------------------------------------------------------------
// Reference spine (mirrors the URL /biblia/{version}/{libro}/{capitulo})
// ---------------------------------------------------------------------------

export interface Referencia {
  version: string;
  libro: string;
  capitulo: number;
  versiculo?: number;
}

// ---------------------------------------------------------------------------
// Attribution (CC BY 4.0)
// ---------------------------------------------------------------------------

export interface Atribucion {
  fuente: string;
  licencia: string;
}

// ---------------------------------------------------------------------------
// Module type discriminated union
// Design-authoritative list (tasks artifact 1.2).
// ---------------------------------------------------------------------------

export type ModuloTipo = 'lectura' | 'strong' | 'diccionario' | 'comparar' | 'notas' | 'tsk';

// ---------------------------------------------------------------------------
// Module contract
// ---------------------------------------------------------------------------

export interface ContextoModulo {
  referencia: Referencia;
}

export interface SalidaModulo {
  datos: unknown;
  atribucion: Atribucion;
}

/**
 * ModuloRegistro — the ONLY coupling point between a module and the workspace
 * shell. Shells consume this interface; modules implement it.
 *
 * No layout-specific fields (pixel widths, panel positions, z-index, etc.)
 * are allowed here. Presentation state lives in EstadoModulo (workspace store).
 */
export interface ModuloRegistro {
  /** Unique module instance identifier. */
  id: string;

  /** Discriminated type — drives shell rendering decisions. */
  tipo: ModuloTipo;

  /** Human-readable label shown in the module menu and tab/panel headers. */
  etiqueta: string;

  /**
   * Load module data for the given reference context.
   * Implementations MUST fetch from prebuilt static JSON; no runtime DB access.
   */
  cargar(ctx: ContextoModulo): Promise<SalidaModulo>;

  /**
   * Optional path to the interactive Astro island component.
   * When present, the shell hydrates this island with `client:visible`.
   * Static modules (read-only content) may omit this field.
   */
  isla?: string;

  /** Attribution metadata displayed alongside every rendered output. */
  atribucion: Atribucion;
}
