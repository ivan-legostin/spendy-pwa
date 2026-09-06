/**
 * Оповещение экранов о том, что к БД применены изменения с других устройств.
 *
 * Локальные правки экраны отражают сами — они же их и делают. А обмен может
 * пройти в фоне, пока пользователь смотрит на список, и без оповещения список
 * останется со старыми данными до перехода на другой экран.
 */

/**
 * Счётчик применений. Меняется при каждом применении чужих записей,
 * и его смена перезапускает загрузку данных на экранах.
 */
let appliedChangesVersion = 0;

/**
 * Подписчики на применение чужих записей.
 */
const listeners = new Set<() => void>();

/**
 * Сообщить, что к БД применены записи с других устройств.
 */
export function notifyAppliedChanges(): void {
  appliedChangesVersion++;
  listeners.forEach(listener => listener());
}

/**
 * Подписаться на применение чужих записей.
 *
 * @param listener вызывается после каждого применения.
 * @returns функция отписки.
 */
export function subscribeToAppliedChanges(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Получить текущее значение счётчика применений.
 *
 * @returns счётчик, пригодный в качестве зависимости эффекта.
 */
export function getAppliedChangesVersion(): number {
  return appliedChangesVersion;
}
