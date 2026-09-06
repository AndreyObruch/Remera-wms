# ДОСЬЕ · WMS «РЕМЕРА» v2.0 «ВНУТРЕННИЙ КОНТУР»
Обновлено: 07.09.2026. Закрыт этап: Фаза 4b (экспорт CSV). Связка с 1С двусторонняя.

## 0. ПРАВИЛА
0.1. Одна команда на ответ, пошагово; кратко и по делу.
0.2. Файл на замену: полный текст + точный путь; проверка в GitHub Desktop; Push origin.
0.3. Без переноса в новый чат; после каждого закрытого этапа — обновлённый DOSSIER.md файлом.
0.4. Футер: «📊 Заполненность ~X% | Сжатие».

## 1. ЦЕЛЬ — ДОСТИГНУТА (ядро + боевой контур + обмен с 1С)
Работник: телефон → PIN → рапорт (конструктор команд или вручную). Директор: липкая очередь →
«Провести/Отклонить» → остатки меняются. Бухгалтер: только чтение.
Импорт остатков из 1С (CSV) и выгрузка остатков/журнала в 1С (CSV) — работают.
Данные — Blob private (wms2/state.json). Без MAX/Telegram.

## 2. АРХИТЕКТУРА
Домен: https://remera-wms-bvii.vercel.app (две i).
chat.html → /api/auth, /api/chat, /api/approve, /api/stock, /api/import, /api/export →
lib/core.js (домен, словарь 108 позиций) + lib/store.js v14 → Blob remera-private.
index.html (учебная БД v1, SQLite-WASM) — тренажёр; кнопка «💬 Чат» (меню ролей) и «❓ Руководство» → guide.html.

## 3. ДАННЫЕ (wms2/state.json)
{version, stock:{CODE:qty}, pending:[], movements:[], messages:[]}
approve → movements + stock по sign; защита от минуса; идемпотентность (дубль → 200 dup);
import → stock:=qty + движение type=import (prev/next), лимит 2000 строк, отчёт об ошибках;
export → CSV (; , BOM \uFEFF для Excel): kind=stock|movements, директор+бухгалтер.

## 4. ENV (эталон)
WORKER_PIN=1234, DIRECTOR_PIN=5678, ACCOUNTANT_PIN=2468,
PRIV_READ_WRITE_TOKEN, PRIV_STORE_ID, PRIV_WEBHOOK_PUBLIC_KEY.

## 5. ФАЙЛЫ (текущие версии)
lib/store.js v14 · lib/core.js (3 роли, NOMENCLATURE+DAILY_NORM = 108 поз. из db.js) ·
api/auth.js · api/chat.js v2 · api/approve.js v3 · api/stock.js · api/import.js · api/export.js ·
chat.html (конструктор команд с поиском и группами, липкая очередь, импорт+экспорт CSV) ·
index.html (тулбар: зелёный чат-меню, белое руководство) · guide.html (страница-руководство).

## 6. СДЕЛАНО (все этапы)
Ремонт store/SDK → Фаза 1 → уборка → Фаза 2 (проводки) → упрочнение v14/идемпотентность →
Фаза Б (бухгалтер) → UI-пакет (кнопка чата с меню ролей, guide.html, возврат на дашборд) →
словарь 108 поз. синхронизирован с db.js → Фаза 4 (импорт CSV 1С) → Фаза 4b (экспорт CSV, тест 07.09).

## 7. УРОКИ (конденсат)
SDK latest + Redeploy without cache; access везде; allowOverwrite; битый JSON → defaultState;
get() форма {stream,blob}; Push после commit; NOT_FOUND = коммит не доехал; Env со следующего деплоя;
двойной клик → идемпотентность; withState-always-save → safe-флаг;
БОЛЬШИЕ ВСТАВКИ обрезаются → проверять Ctrl+End (</html>) и маркеры; кэш → Ctrl+Shift+R/инкогнито;
favicon 404 безвреден; «Импорт БД» (v1, .sqlite) ≠ «Импорт CSV» (v2); CSV для Excel → BOM \uFEFF;
выгрузка файлом проще всего через location.href на GET-эндпоинт.

## 8. ДОРОЖНАЯ КАРТА (осталось)
5a: аналитика живого контура — точка заказа и прогноз: «остаток < недельной нормы → пора заказывать,
рекомендуемый объём» (исполняет обещание из письма директору). РЕКОМЕНДУЮ СЛЕДУЮЩИМ.
Фаза 3: уведомления (Resend — ОТКРЫТЫЙ ВОПРОС с заказчиком).
5b: QR-инвентаризация. 5c: JWT вместо PIN.

## 9. РИСКИ
Blob без транзакций (ок для 2–3 пользователей); PIN = MVP (JWT в 5c);
учебная БД v1 и живой контур v2 — разные миры, не смешивать кнопки импорта.