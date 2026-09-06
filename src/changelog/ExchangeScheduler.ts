import { exchangeChanges } from './ChangeLogService.ts';

/**
 * Пауза после локальной правки перед отправкой.
 *
 * Нужна, чтобы серия правок подряд уехала одной отправкой, а не породила
 * коммит на каждую.
 */
const EXCHANGE_DELAY_MS = 5000;

/**
 * Отложенный обмен, назначенный после локальной правки.
 */
let scheduledExchange: number | undefined;

/**
 * Выполнить обмен, не показывая ошибок пользователю.
 *
 * Автоматический обмен срывается штатно — в метро, в самолёте, с истёкшим
 * токеном. Показывать это при каждом открытии приложения незачем: неотправленные
 * записи остаются в исходящем журнале, а разобраться помогает кнопка в настройках.
 *
 * @returns promise, завершающийся после обмена — в том числе неудачного.
 */
export function exchangeQuietly(): Promise<void> {
  return exchangeChanges()
    .then(() => undefined)
    .catch((error: unknown) => console.warn('Обмен не удался', error));
}

/**
 * Запланировать обмен после локальной правки.
 *
 * Каждый вызов сдвигает срок: обмен случится через паузу после последней правки.
 */
export function scheduleExchange(): void {
  clearTimeout(scheduledExchange);
  scheduledExchange = setTimeout(exchangeQuietly, EXCHANGE_DELAY_MS);
}

/**
 * Включить автоматический обмен: при запуске и при возврате приложения из фона.
 *
 * @returns функция отключения.
 */
export function startAutomaticExchange(): () => void {
  exchangeQuietly();

  const exchangeOnReturn = () => {
    if (document.visibilityState === 'visible') {
      exchangeQuietly();
    }
  };
  document.addEventListener('visibilitychange', exchangeOnReturn);

  return () => {
    document.removeEventListener('visibilitychange', exchangeOnReturn);
    clearTimeout(scheduledExchange);
  };
}
