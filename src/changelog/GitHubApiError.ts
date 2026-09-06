/**
 * Ошибка обращения к GitHub.
 */
export class GitHubApiError extends Error {
  /**
   * HTTP-статус ответа; 0, если ответа не было вовсе.
   */
  readonly status: number;

  /**
   * @param status HTTP-статус ответа.
   * @param message сообщение для показа пользователю.
   */
  constructor(status: number, message: string) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
  }
}
