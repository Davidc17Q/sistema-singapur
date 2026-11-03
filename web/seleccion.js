// Selección compartida del mapa, la tabla de zonas y la lista de atracciones.
// Lógica pura: sin DOM ni MapLibre, para poder probarla con `node --test verificacion/`.
// Los componentes escriben aquí y leen de aquí; ninguno llama a otro. Por eso no hay bucles entre ellos.
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.Seleccion = fabrica();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ORIGENES = ['mapa', 'tabla', 'lista'];

  /** Todas las áreas del mismo town de HDB. Un town puede cubrir varias (CENTRAL AREA → 3). Sin town, la propia área. */
  function areasDelTown(zona, townPorZona) {
    if (!zona) return [];
    const t = townPorZona[zona];
    return t ? t.zonas.slice() : [zona];
  }

  /** Nombre del town de la zona, o null si el área no tiene reventas HDB (26 de 55). */
  function townDeZona(zona, townPorZona) {
    const t = zona ? townPorZona[zona] : null;
    return t ? t.town : null;
  }

  /** Índices de las atracciones que coinciden con la búsqueda. Misma regla que usaba la lista: nombre o área. */
  function filtrar(filas, consulta) {
    const q = String(consulta || '').trim().toLowerCase();
    const indices = [];
    filas.forEach((f, i) => {
      if (!q || f.nombre.toLowerCase().includes(q) || (f.zona || '').toLowerCase().includes(q)) indices.push(i);
    });
    return indices;
  }

  /** Cuántas tarjetas hay que mostrar para que la de posición `posicion` quede visible. Crece de `paso` en `paso`. */
  function paginaPara(posicion, visibles, paso) {
    if (![posicion, visibles, paso].every(Number.isInteger) || posicion < 0 || visibles < 1 || paso < 1) {
      throw new RangeError('paginaPara: argumentos inválidos');
    }
    return posicion < visibles ? visibles : visibles + Math.ceil((posicion + 1 - visibles) / paso) * paso;
  }

  /**
   * @param {{zonas: string[], townPorZona: Object, atracciones: Array<{zona: string|null}>}} datos
   *   zonas: nombres de las 55 áreas del mapa. atracciones: las filas de atracciones.json; el id de una atracción es su posición.
   */
  function crear({ zonas, townPorZona, atracciones }) {
    const conocidas = new Set(zonas);
    let estado = Object.freeze({ zona: null, atraccion: null, origen: null });
    let suscriptores = [];
    let avisando = false;

    function origenValido(origen) {
      if (!ORIGENES.includes(origen)) throw new RangeError(`origen inválido: ${origen}`);
    }

    function cambiar(siguiente) {
      if (avisando) throw new Error('Un suscriptor intentó cambiar la selección mientras se avisaba a los demás. Los componentes solo deben leerla.');
      if (siguiente.zona === estado.zona && siguiente.atraccion === estado.atraccion) return false;
      const anterior = estado;
      estado = Object.freeze(siguiente);
      avisando = true;
      const errores = [];
      try {
        for (const fn of suscriptores.slice()) {
          // Un componente que falla no debe dejar a los demás con la selección vieja
          try { fn(estado, anterior); } catch (e) { errores.push(e); }
        }
      } finally { avisando = false; }
      if (errores.length) throw errores[0];
      return true;
    }

    return {
      /** Estado actual. Es inmutable: mutarlo no cambia la selección. */
      get: () => estado,
      /** Selecciona un área. Quita la atracción seleccionada. Devuelve false si no cambió nada. */
      seleccionarZona(zona, origen) {
        origenValido(origen);
        if (!conocidas.has(zona)) throw new RangeError(`zona desconocida: ${zona}`);
        return cambiar({ zona, atraccion: null, origen });
      },
      /** Selecciona una atracción por su posición y la zona donde cae (null si cae fuera del límite terrestre). */
      seleccionarAtraccion(id, origen) {
        origenValido(origen);
        if (!Number.isInteger(id) || id < 0 || id >= atracciones.length) throw new RangeError(`atracción inexistente: ${id}`);
        return cambiar({ zona: atracciones[id].zona || null, atraccion: id, origen });
      },
      limpiar(origen) {
        origenValido(origen);
        return cambiar({ zona: null, atraccion: null, origen });
      },
      /** Deselecciona la atracción y conserva la zona (cerrar el popup de una atracción no debe borrar el área elegida). */
      quitarAtraccion(origen) {
        origenValido(origen);
        return cambiar({ zona: estado.zona, atraccion: null, origen });
      },
      /** Registra un suscriptor `(estado, anterior) => void`. Devuelve la función que lo cancela. */
      suscribir(fn) {
        suscriptores.push(fn);
        return () => { suscriptores = suscriptores.filter((x) => x !== fn); };
      },
    };
  }

  return { ORIGENES, crear, areasDelTown, townDeZona, filtrar, paginaPara };
});
