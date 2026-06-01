import { useCallback } from "react";
import { FieldValues, UseFormReset, DefaultValues } from "react-hook-form";

/**
 * Hook reutilizable para limpiar formularios al estado inicial.
 *
 * @param reset       - Función reset de react-hook-form
 * @param initialValues - Valores vacíos / por defecto para un nuevo registro
 * @param extraResets - Funciones adicionales para limpiar estado local (archivos, previews, errores, etc.)
 * @returns limpiarCampos - Función que restaura el formulario a su estado inicial sin cerrar el modal
 */
export function useLimpiarCampos<T extends FieldValues>(
  reset: UseFormReset<T>,
  initialValues: DefaultValues<T>,
  extraResets?: Array<() => void>
): () => void {
  return useCallback(() => {
    reset(initialValues);
    extraResets?.forEach((fn) => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reset]);
}
