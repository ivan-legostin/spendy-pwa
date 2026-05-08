import React, { useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { getAllCategories } from '../dao/service/CategoryDaoService';
import { saveCategories } from '../dao/service/CategoryDaoService.ts';
import { saveTransactions, clearTransactions } from '../dao/service/TransactionDaoService.ts';
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
 * Экран настроек приложения.
 */
export default function SettingsScreen() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
        <button className="settings__item" onClick={() => fileInputRef.current?.click()}>
          <div className="settings__item-text">
            <span className="settings__item-label">Импортировать CSV</span>
            <span className="settings__item-description">Загрузить транзакции из файла</span>
          </div>
          <div className="settings__item-icon settings__item-icon--green">
            <Download size={22} color="#fff" />
          </div>
        </button>
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
