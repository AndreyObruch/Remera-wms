# ДОСЬЕ · WMS «РЕМЕРА» v2.0 «ВНУТРЕННИЙ КОНТУР»
Обновлено: 07.09.2026. Закрыт этап: Фаза 5a (точка заказа и прогноз закупок).

## 0. ПРАВИЛА
0.1. Одна команда на ответ, пошагово; кратко и по делу.
0.2. Файл на замену: полный текст + точный путь; проверка в GitHub Desktop; Push origin.
0.3. Без переноса в новый чат; после каждого закрытого этапа — обновлённый DOSSIER.md файлом.
0.4. Футер: «📊 Заполненность ~X% | Сжатие».

## 1. ЦЕЛЬ — ДОСТИГНУТА (ядро + боевой контур + 1С + прогноз)
Работник: телефон → PIN → рапорт (конструктор команд или вручную). Директор: липкая очередь →
«Провести/Отклонить» → остатки меняются. Бухгалтер: только чтение.
Импорт/экспорт CSV (1С) двусторонний. Аналитика: запас < 7 дней расхода → «пора заказывать + объём».
Данные — Blob private (wms2/state.json). Без MAX/Telegram.

## 2. АРХИТЕКТУРА
Домен: https://remera-wms-bvii.vercel.app (две i).
chat.html → /api/auth, /api/chat, /api/approve, /api/stock, /api/import, /api/export, /api/analytics →
lib/core.js (домен, словарь 108 позиций, DAILY_NORM) + lib/store.js v14 → Blob remera-private.
index.html (учебная БД v1, SQLite-WASM) — тренажёр; «💬 Чат» (меню ролей), «❓ Руководство» → guide.html.

## 3. ДАННЫЕ (wms2/state.json)
{version, stock:{CODE:qty}, pending:[], movements:[], messages:[]}
approve → movements + stock по sign; защита от минуса; идемпотентность (дубль → 200 dup);
import → stock:=qty + движение type=import (prev/next), лимит 2000 строк;
export → CSV (; , BOM \uFEFF): kind=stock|movements;
analytics → по stock и DAILY_NORM: daysLeft=stock/norm, порог 7 дней, recommended=norm*14−stock,
сортировка по срочности, daysLeft≤1 → красным.

## 4. ENV (эталон)
WORKER_PIN=1234, DIRECTOR_PIN=5678, ACCOUNTANT_PIN=2468,
PRIV_READ_WRITE_TOKEN, PRIV_STORE_ID, PRIV_WEBHOOK_PUBLIC_KEY.

## 5. ФАЙЛЫ (текущие версии)
lib/store.js v14 · lib/core.js (108 поз.) · api/auth.js · api/chat.js v2 · api/approve.js v3 ·
api/stock.js · api/import.js · api/export.js · api/analytics.js ·
chat.html (конструктор команд, липкая очередь, импорт/экспорт CSV, вкладка «Аналитика») ·
index.html (тулбар: чат-меню, руководство) · guide.html (страница-руководство).

## 6. СДЕЛАНО (все этапы)
Ремонт store/SDK → Фаза 1 → уборка → Фаза 2 (проводки) → упрочнение v14/идемпотентность →
Фаза Б (бухгалтер) → UI-пакет (чат-меню, guide.html) → словарь 108 поз. → Фаза 4 (импорт CSV) →
Фаза 4b (экспорт CSV) → Фаза 5a (точка заказа, тест 07.09: PA-F 0.8 дн/1980, PES-F 0.6 дн/1600).

## 7. УРОКИ (конденсат)
SDK latest + Redeploy without cache; access везде; allowOverwrite; битый JSON → defaultState;
get() форма {stream,blob}; Push после commit; NOT_FOUND = коммит не доехал; Env со следующего деплоя;
двойной клик → идемпотентность; withState-always-save → safe-флаг;
БОЛЬШИЕ ВСТАВКИ обрезаются → проверять Ctrl+End (</html>) и маркеры; кэш → Ctrl+Shift+R/инкогнито;
favicon 404 безвреден; «Импорт БД» (v1, .sqlite) ≠ «Импорт CSV» (v2); CSV для Excel → BOM \uFEFF;
выгрузка файлом — через location.href на GET-эндпоинт.

## 8. ДОРОЖНАЯ КАРТА (осталось)
5a-mini: обновить guide.html под новые возможности (Аналитика, импорт/экспорт CSV живого контура).
РЕКОМЕНДУЮ СЛЕДУЮЩИМ — руководство читает директор, оно должно совпадать с системой.
Фаза 3: уведомления (Resend — ОТКРЫТЫЙ ВОПРОС с заказчиком).
5b: QR-инвентаризация. 5c: JWT вместо PIN.

## 9. РИСКИ
Blob без транзакций (ок для 2–3 пользователей); PIN = MVP (JWT в 5c);
учебная БД v1 и живой контур v2 — разные миры, не смешивать кнопки импорта.