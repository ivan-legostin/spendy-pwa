/**
 * Ключи настроек, хранящихся в БД.
 */
export enum SettingKey {
  /**
   * Personal access token GitHub с правом записи в репозиторий журнала.
   */
  githubToken = 'githubToken',
  /**
   * Идентификатор устройства — имя каталога, в который пишет это устройство.
   */
  deviceId = 'deviceId',
}
