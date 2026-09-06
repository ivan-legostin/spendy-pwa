/**
 * Ключи служебного состояния обмена журналом.
 */
export enum ChangeLogStateKey {
  /**
   * Соответствие пути файла в репозитории его blob sha на момент последнего чтения.
   * Позволяет не скачивать файлы, которые не изменились.
   */
  remoteFileShas = 'remoteFileShas',
  /**
   * Момент последнего успешного обмена журналом с репозиторием в виде Unix timestamp (миллисекунды).
   */
  lastExchangeTimestamp = 'lastExchangeTimestamp',
}
