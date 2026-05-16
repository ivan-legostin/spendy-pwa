import React, { useEffect, useRef, useState } from 'react';
import { Download, FolderOpen, HardDrive, ShieldAlert, Upload } from 'lucide-react';

function selectFileDescription(fsStatus: FileSystemStatus | null, permissionState: PermissionState | null): { text: string; subtext?: string; error: boolean } {
  if (fsStatus?.lastSaveError) return { text: fsStatus.lastSaveError, error: true };
  if (permissionState === 'denied') return { text: 'Доступ запрещён. Разрешите запись в настройках браузера.', error: true };
  if (fsStatus?.fileName && fsStatus?.lastSaveTime) return { text: fsStatus.fileName, subtext: `Сохранено: ${formatDateTime(fsStatus.lastSaveTime)}`, error: false };
  if (fsStatus?.fileName) return { text: fsStatus.fileName, error: false };
  return { text: 'Файл для автоматического сохранения транзакций', error: false };
}
import { getAllCategories } from '../dao/service/CategoryDaoService';
import { saveCategories } from '../dao/service/CategoryDaoService.ts';
import { saveTransactions, clearTransactions, getAllTransactions } from '../dao/service/TransactionDaoService.ts';
import {
  isSupported as isFsSupported,
  selectFile,
  requestAccess,
  getPermissionState,
  getStatus,
  FileSystemStatus,
} from '../dao/service/FileSystemService.ts';
import { exportToCsv } from '../utils/CsvExporter';
import { parseCsv } from '../utils/CsvParser';
import './SettingsScreen.css';

function formatDateTime(timestamp: number): string {
  const d = new Date(timestamp);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${d.getFullYear()}, ${hours}:${minutes}`;
}

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
 * Экран настроек приложения.
 */
export default function SettingsScreen() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [fsStatus, setFsStatus] = useState<FileSystemStatus | null>(null);
  const [permissionState, setPermissionState] = useState<PermissionState | null>(null);

  useEffect(() => {
    if (!isFsSupported()) return;
    Promise.all([getStatus(), getPermissionState()]).then(([s, p]) => {
      setFsStatus(s);
      setPermissionState(p);
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
      getAllTransactions(),
      getAllCategories(),
    ]);
    exportToCsv(transactions, categories);
  }

  async function processImport(file: File, replace: boolean) {
    setPendingFile(null);
    const text = await file.text();
    const existingCategories = await getAllCategories();
    const { transactions, categories, errors } = parseCsv(text, existingCategories);
    if (replace) await clearTransactions();
    await saveCategories(categories);
    await saveTransactions(transactions);
    let status = `Импортировано: ${transactions.length} транзакций, ${categories.length} новых категорий`;
    if (errors.length > 0) {
      const details = errors.map(e => `строка ${e.line}: ${e.message}`).join('; ');
      status += `. Пропущено строк: ${errors.length} (${details})`;
    }
    setStatus(status);
  }

  async function handleSelectFile() {
    try {
      await selectFile();
    } catch {
      // Пользователь закрыл диалог
    }
    const [s, p] = await Promise.all([getStatus(), getPermissionState()]);
    setFsStatus(s);
    setPermissionState(p);
  }

  async function handleRequestAccess() {
    await requestAccess();
    const [s, p] = await Promise.all([getStatus(), getPermissionState()]);
    setFsStatus(s);
    setPermissionState(p);
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
              <div className="settings__item-icon settings__item-icon--blue">
                <Download size={22} color="#fff"/>
              </div>
              <div className="settings__item-text">
                <span className="settings__item-label">Импортировать CSV</span>
                <span className="settings__item-description">Загрузить транзакции из файла</span>
              </div>
            </button>
            <button className="settings__item" onClick={handleExport}>
              <div className="settings__item-icon settings__item-icon--blue">
                <Upload size={22} color="#fff"/>
              </div>
              <div className="settings__item-text">
                <span className="settings__item-label">Экспортировать CSV</span>
                <span className="settings__item-description">Сохранить транзакции в файл</span>
              </div>
            </button>
          </div>

          <div className="settings__group">
            <div className="settings__section-header">
              <h2 className="settings__section-title">Автосохранение</h2>
            </div>
            {!isFsSupported() ? (
              <div className="settings__item settings__item--static">
                <div className="settings__item-icon settings__item-icon--gray">
                  <HardDrive size={22} color="#fff"/>
                </div>
                <div className="settings__item-text">
                  <span className="settings__item-label">Не поддерживается</span>
                  <span className="settings__item-description">Доступно только в браузерах Chrome и Edge</span>
                </div>
              </div>
            ) : (
              <>
                <button className="settings__item" onClick={handleSelectFile}>
                  <div className="settings__item-icon settings__item-icon--blue">
                    <FolderOpen size={22} color="#fff"/>
                  </div>
                  <div className="settings__item-text">
                    <span className="settings__item-label">
                      {fsStatus?.fileName ? 'Изменить файл' : 'Выбрать файл'}
                    </span>
                    {(() => {
                      const { text, subtext, error } = selectFileDescription(fsStatus, permissionState);
                      return (
                        <>
                          <span className={`settings__item-description${error ? ' settings__item-description--error' : ''}`}>
                            {text}
                          </span>
                          {subtext && <span className="settings__item-description">{subtext}</span>}
                        </>
                      );
                    })()}
                  </div>
                </button>
                {permissionState === 'prompt' && (
                  <button className="settings__item" onClick={handleRequestAccess}>
                    <div className="settings__item-icon settings__item-icon--orange">
                      <ShieldAlert size={22} color="#fff"/>
                    </div>
                    <div className="settings__item-text">
                      <span className="settings__item-label">Подтвердить доступ</span>
                      <span className="settings__item-description">
                        Браузер запрашивает разрешение на запись файла
                      </span>
                    </div>
                  </button>
                )}
              </>
            )}
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
