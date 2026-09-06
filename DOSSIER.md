# ДОСЬЕ · WMS «РЕМЕРА» v2.0 «ВНУТРЕННИЙ КОНТУР»
Обновлено: 2026-09-06. Закрыт этап: Фаза Б (три роли). Система работает end-to-end.

## 0. ПРАВИЛА
0.1. Одна команда на ответ, пошагово; кратко и по делу.
0.2. Файл на замену: полный текст + точный путь; проверка в GitHub Desktop; Push origin.
0.3. Без переноса в новый чат; после каждого закрытого этапа — обновлённый DOSSIER.md файлом.
0.4. Футер: «📊 Заполненность ~X% | Сжатие».

## 1. ЦЕЛЬ — ДОСТИГНУТА (ядро)
Работник: телефон → PIN → рапорт в чате. Директор: очередь → «Провести» → остаток меняется.
Бухгалтер: только чтение — «Остатки» + «Журнал». Без MAX/Telegram. Данные — Blob private.

## 2. АРХИТЕКТУРА
Домен: https://remera-wms-bvii.vercel.app (две i). Чат: /chat.html (сессия localStorage; «Выйти»).
chat.html → /api/auth, /api/chat, /api/approve, /api/stock → lib/core.js + lib/store.js v14 → Blob remera-private (wms2/state.json).
SDK @vercel/blob latest: access:'private' везде; allowOverwrite:true; get()={statusCode,stream,headers,blob}; чтение: blob.blob.text() / new Response(blob.stream).text().

## 3. ДАННЫЕ (wms2/state.json)
{version, stock:{CODE:qty}, pending:[], movements:[], messages:[]}
approve → movements + stock по sign; защита от минуса; идемпотентность (дубль → 200 dup);
withState не сохраняет, если blob существует, но не читается (защита от затирания).

## 4. ENV (эталон)
WORKER_PIN=1234, DIRECTOR_PIN=5678, ACCOUNTANT_PIN=2468,
PRIV_READ_WRITE_TOKEN, PRIV_STORE_ID, PRIV_WEBHOOK_PUBLIC_KEY.

## 5. ФАЙЛЫ (текущие версии)
lib/store.js v14 · lib/core.js (3 роли) · api/auth.js · api/chat.js v2 (с логами) ·
api/approve.js v3 · api/stock.js · chat.html (вкладки Чат/Остатки/Журнал; бухгалтер без ввода).
Удалены: debug.js, bot-файлы, старый store. v1 legacy не тронут.

## 6. СДЕЛАНО (все этапы)
Ремонт (store/SDK/PIN) → сквозной тест Фаза 1 → уборка → Фаза 2 (проводки: приход 0→10, расход 10→5, защита от минуса) → упрочнение (v14, идемпотентность) → Фаза Б (бухгалтер: остатки+журнал, тест пройден 06.09).

## 7. УРОКИ (конденсат)
SDK latest + Redeploy without cache; access везде; allowOverwrite; пустой/битый JSON → defaultState;
get() форма {stream,blob}; «No local changes» = файл не перезаписан; Push после commit;
NOT_FOUND = коммит не доехал; Env со следующего деплоя; двойной клик → идемпотентность;
withState-always-save → защита safe-флагом.

## 8. ДОРОЖНАЯ КАРТА (осталось)
Фаза 3: уведомления (Resend — ОТКРЫТЫЙ ВОПРОС с заказчиком).
Фаза 4: импорт остатков из 1С (CSV → stock, директор); бейдж «учебная БД» на v1.
Фаза 5: QR-инвентаризация; аналитика («мёртвый груз», оборачиваемость); JWT вместо PIN.
Рекомендация следующего шага: Фаза 4 (CSV-импорт) — без начальных остатков система стартует пустой.

## 9. РИСКИ
Blob без транзакций (ок для 2–3 пользователей); PIN = MVP (JWT в Фазе 5).