import React, { useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, Upload } from 'lucide-react';
import { SettingKey } from '../dao/models/SettingKey.ts';
import { ChangeLogStateKey } from '../dao/models/ChangeLogStateKey.ts';
import * as categoryRepository from '../dao/service/CategoryDaoService.ts';
import * as changeLogStateRepository from '../dao/service/ChangeLogStateDaoService.ts';
import * as outboxRepository from '../dao/service/OutboxDaoService.ts';
import * as settingsRepository from '../dao/service/SettingsDaoService.ts';
import * as transactionRepository from '../dao/service/TransactionDaoService.ts';
import * as transactionService from '../service/TransactionService.ts';
import { ExchangeResult } from '../changelog/ExchangeResult.ts';
import { exchangeChanges } from '../changelog/ChangeLogService.ts';
import { exportToCsv } from '../utils/CsvExporter';
import { parseCsv } from '../utils/CsvParser';
import './SettingsScreen.css';

function ImportDialog({ onReplace, onAppend, onCancel }: Readonly<{
  onReplace: () => void
  onAppend: () => void
  onCancel: () => void
}>) {
  return (
    <dialog open aria-label="Импорт транзакций" className="import-dialog" onClose={onCancel}>
      <h2 className="import-dialog__title">Импорт транзакций</h2>
      <p className="import-dialog__body">Что сделать с текущими транзакциями?</p>
      <div className="import-dialog__actions">
        <button className="import-dialog__btn import-dialog__btn--danger" onClick={onReplace}>
          Заменить
        </button>
        <button className="import-dialog__btn import-dialog__btn--primary" onClick={onAppend}>
          Добавить к существующим
        </button>
        <button className="import-dialog__btn import-dialog__btn--cancel" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </dialog>
  )
}

/**
 * Привести имя устройства к виду, пригодному для пути в репозитории.
 *
 * @param value введённое значение.
 * @returns строка из латиницы, цифр и дефисов.
 */
function normalizeDeviceId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

/**
 * Описать итог обмена для показа пользователю.
 *
 * Числа прочитанных и всех файлов нужны для диагностики: они показывают решение
 * устройства о том, что пропустить по кешу версий, которого не видно ни в репозитории,
 * ни где-либо ещё на телефоне.
 *
 * @param result итог обмена.
 * @returns строка для показа.
 */
function describeExchange(result: ExchangeResult): string {
  const parts = [
    `отправлено ${result.sentCount}`,
    `применено ${result.appliedCount}`,
    `прочитано файлов ${result.readPaths.length} из ${result.totalFileCount}`,
  ];
  if (result.brokenLineCount > 0) {
    parts.push(`повреждённых строк ${result.brokenLineCount}`);
  }
  const summary = `Обмен завершён: ${parts.join(', ')}`;
  return result.readPaths.length > 0 ? `${summary}. Прочитаны: ${result.readPaths.join(', ')}` : summary;
}

/**
 * Описать состояние журнала под кнопкой обмена.
 *
 * @param pendingCount число неотправленных записей.
 * @param lastExchangeTimestamp момент последнего обмена.
 * @returns строка для показа.
 */
function describeChangeLogState(pendingCount: number, lastExchangeTimestamp: number | undefined): string {
  if (pendingCount > 0) {
    return `Не отправлено записей: ${pendingCount}`;
  }
  if (lastExchangeTimestamp) {
    return `Последний обмен: ${new Date(lastExchangeTimestamp).toLocaleString('ru-RU')}`;
  }
  return 'Обмена ещё не было';
}

/**
 * Экран настроек приложения.
 */
export default function SettingsScreen() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [githubToken, setGithubToken] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [lastExchangeTimestamp, setLastExchangeTimestamp] = useState<number | undefined>(undefined);
  const [isExchanging, setIsExchanging] = useState(false);

  useEffect(() => {
    Promise.all([
      settingsRepository.getSetting<string>(SettingKey.githubToken),
      settingsRepository.getSetting<string>(SettingKey.deviceId),
      outboxRepository.count(),
      changeLogStateRepository.getChangeLogState<number>(ChangeLogStateKey.lastExchangeTimestamp),
    ]).then(([token, device, count, timestamp]) => {
      setGithubToken(token ?? '');
      setDeviceId(device ?? '');
      setPendingCount(count);
      setLastExchangeTimestamp(timestamp);
    });
  }, []);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleExport() {
    const [transactions, categories] = await Promise.all([
      transactionRepository.findAll(),
      categoryRepository.findAll(),
    ]);
    exportToCsv(transactions, categories);
  }

  async function processImport(file: File, replace: boolean) {
    setPendingFile(null);
    const text = await file.text();
    const existingCategories = await categoryRepository.findAll();
    const { transactions, categories, errors } = parseCsv(text, existingCategories);
    if (replace) await transactionService.deleteAll();
    await categoryRepository.saveAll(categories);
    await transactionService.saveAll(transactions);
    let status = `Импортировано: ${transactions.length} транзакций, ${categories.length} новых категорий`;
    if (errors.length > 0) {
      const details = errors.map(e => `строка ${e.line}: ${e.message}`).join('; ');
      status += `. Пропущено строк: ${errors.length} (${details})`;
    }
    setStatus(status);
    setPendingCount(await outboxRepository.count());
  }

  async function handleTokenChange(value: string) {
    setGithubToken(value);
    await settingsRepository.saveSetting(SettingKey.githubToken, value);
  }

  async function handleDeviceIdChange(value: string) {
    const normalized = normalizeDeviceId(value);
    setDeviceId(normalized);
    await settingsRepository.saveSetting(SettingKey.deviceId, normalized);
  }

  async function handleExchange() {
    setIsExchanging(true);
    setStatus(null);
    try {
      const result = await exchangeChanges();
      setStatus(describeExchange(result));
      setLastExchangeTimestamp(Date.now());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Не удалось обменяться изменениями');
    } finally {
      setPendingCount(await outboxRepository.count());
      setIsExchanging(false);
    }
  }

  return (
    <div className="settings">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <h1 className="settings__title">Настройки</h1>
      <div className="settings__list">
        <div className="settings__section">
          <div className="settings__group">
            <div className="settings__section-header">
              <h2 className="settings__section-title">Файлы</h2>
            </div>
            <button className="settings__item" onClick={() => fileInputRef.current?.click()}>
              <div className="settings__item-icon settings__item-icon--green">
                <Download size={22} color="#fff"/>
              </div>
              <div className="settings__item-text">
                <span className="settings__item-label">Импортировать CSV</span>
                <span className="settings__item-description">Загрузить транзакции из файла</span>
              </div>
            </button>
            <button className="settings__item" onClick={handleExport}>
              <div className="settings__item-icon settings__item-icon--green">
                <Upload size={22} color="#fff"/>
              </div>
              <div className="settings__item-text">
                <span className="settings__item-label">Экспортировать CSV</span>
                <span className="settings__item-description">Сохранить транзакции в файл</span>
              </div>
            </button>
          </div>
        </div>

        <div className="settings__section">
          <div className="settings__group">
            <div className="settings__section-header">
              <h2 className="settings__section-title">Журнал изменений</h2>
            </div>
            <div className="settings__field">
              <label className="settings__field-label" htmlFor="settings-github-token">Токен GitHub</label>
              <input
                id="settings-github-token"
                className="settings__input"
                type="password"
                autoComplete="off"
                placeholder="github_pat_…"
                value={githubToken}
                onChange={event => handleTokenChange(event.target.value)}
              />
            </div>
            <div className="settings__field">
              <label className="settings__field-label" htmlFor="settings-device-id">
                Имя устройства — латиница, цифры и дефис
              </label>
              <input
                id="settings-device-id"
                className="settings__input"
                autoComplete="off"
                placeholder="ivan-iphone"
                value={deviceId}
                onChange={event => handleDeviceIdChange(event.target.value)}
              />
            </div>
            <button className="settings__item" onClick={handleExchange} disabled={isExchanging}>
              <div className="settings__item-icon settings__item-icon--green">
                <RefreshCw size={22} color="#fff"/>
              </div>
              <div className="settings__item-text">
                <span className="settings__item-label">
                  {isExchanging ? 'Идёт обмен…' : 'Обменяться изменениями'}
                </span>
                <span className="settings__item-description">
                  {describeChangeLogState(pendingCount, lastExchangeTimestamp)}
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
      {status && <p className="settings__status">{status}</p>}

      {pendingFile && (
          <ImportDialog
              onReplace={() => processImport(pendingFile, true)}
              onAppend={() => processImport(pendingFile, false)}
              onCancel={() => setPendingFile(null)}
          />
      )}
    </div>
  );
}
