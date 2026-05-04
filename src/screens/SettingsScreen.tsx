import React, { useRef, useState } from 'react';
import {Download} from 'lucide-react';
import { getAllCategories } from '../dao/service/CategoryDaoService';
import { saveCategories } from '../dao/service/CategoryDaoService.ts';
import { saveTransactions } from '../dao/service/TransactionDaoService.ts';
import { parseCsv } from '../utils/CsvParser';
import './SettingsScreen.css';

/**
 * Экран настроек приложения.
 */
export default function SettingsScreen() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const existingCategories = await getAllCategories();
      const { transactions, categories } = parseCsv(text, existingCategories);
      await saveCategories(categories);
      await saveTransactions(transactions);
      setStatus(`Импортировано: ${transactions.length} транзакций, ${categories.length} новых категорий`);
    };
    reader.readAsText(file, 'utf-8');
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
    </div>
  );
}
