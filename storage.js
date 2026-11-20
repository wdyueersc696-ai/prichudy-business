/** Local-only persistence and portable exports. No network requests or DOM evaluation. */
export const STORAGE_KEY = 'prichudy-business-calculator-v1';
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
const MAX_SCENARIOS = 100;
const MAX_LINES = 250;
const APP = 'prichudy-business-calculator';
const BASIS = new Set(['unit', 'batch', 'month']);
const STAGES = new Set(['produced', 'good']);
const PRODUCTS = new Set(['mittens', 'cover']);
const TAX_MODES = new Set(['none', 'revenue', 'profit']);
const CATEGORIES = new Set(['materials', 'production', 'packaging', 'development', 'logistics', 'overhead']);
const NUMBERS = {
  quantity: [0, 1000000], defectPercent: [0, 100], months: [0, 1200],
  reservePercent: [0, 1000], price: [0, 1000000000], discountPercent: [0, 100],
  targetMarginPercent: [0, 100], sellThroughPercent: [0, 100], returnPercent: [0, 100],
  commissionPercent: [0, 100], acquiringPercent: [0, 100], advertisingPerOrder: [0, 1000000000],
  deliveryPerOrder: [0, 1000000000], returnCost: [0, 1000000000], taxPercent: [0, 100],
};
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const failure = (error, extra = {}) => ({ok: false, error, ...extra});

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}: ожидается объект.`);
  if (own(value, '__proto__') || own(value, 'constructor') || own(value, 'prototype')) throw new Error(`${label}: недопустимые поля.`);
  return value;
}
function str(value, label, max = 500, empty = true) {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) throw new Error(`${label}: неверный текст или превышена длина.`);
  return value;
}
function choice(value, options, label) {
  if (!options.has(value)) throw new Error(`${label}: неподдерживаемое значение.`);
  return value;
}
function numeric(value, label, min, max) {
  // An empty quotation is unknown. It must never silently become a zero price.
  if (value === null || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${label}: число вне допустимых границ.`);
  return value;
}
function bool(value, label) {
  if (typeof value !== 'boolean') throw new Error(`${label}: ожидается да/нет.`);
  return value;
}

function normalizeLine(value, index) {
  const label = `Строка ${index + 1}`;
  const line = object(value, label);
  const category = choice(line.category, CATEGORIES, `${label}, категория`);
  return {
    id: str(line.id, `${label}, ID`, 150, false), category,
    title: str(line.title, `${label}, название`, 300), unit: str(line.unit, `${label}, единица`, 60),
    rate: numeric(line.rate, `${label}, цена`, 0, 1000000000),
    consumption: numeric(line.consumption, `${label}, расход`, 0, 1000000000),
    wastePercent: numeric(line.wastePercent, `${label}, запас`, 0, 1000),
    basis: choice(line.basis, BASIS, `${label}, база`),
    stage: choice(line.stage, STAGES, `${label}, стадия`),
    enabled: bool(line.enabled, `${label}, включение`),
    supplier: str(line.supplier ?? '', `${label}, поставщик`, 500),
    notes: str(line.notes ?? '', `${label}, заметки`, 10000),
  };
}

export function normalizeScenario(value) {
  const raw = object(value, 'Расчёт');
  const result = {
    id: str(raw.id, 'ID расчёта', 150, false), name: str(raw.name, 'Название расчёта', 300),
    product: choice(raw.product, PRODUCTS, 'Изделие'), demo: bool(raw.demo, 'Демонстрационный расчёт'),
    taxMode: choice(raw.taxMode, TAX_MODES, 'Режим налога'), notes: str(raw.notes ?? '', 'Заметки', 20000),
  };
  for (const [key, bounds] of Object.entries(NUMBERS)) result[key] = numeric(raw[key], key, ...bounds);
  if (!Array.isArray(raw.lines) || raw.lines.length > MAX_LINES) throw new Error(`В расчёте допускается не более ${MAX_LINES} строк затрат.`);
  result.lines = raw.lines.map(normalizeLine);
  if (new Set(result.lines.map(line => line.id)).size !== result.lines.length) throw new Error('В расчёте повторяются ID строк.');
  for (const key of ['createdAt', 'updatedAt']) {
    if (raw[key] !== undefined) result[key] = str(raw[key], key, 50);
  }
  return result;
}

export function normalizeState(value) {
  const raw = object(value, 'Данные');
  if (raw.schemaVersion !== 1) throw new Error('Неподдерживаемая версия файла. Ожидается версия 1.');
  if (!Array.isArray(raw.scenarios) || raw.scenarios.length < 1 || raw.scenarios.length > MAX_SCENARIOS) throw new Error(`В файле должен быть хотя бы один расчёт; допускается не более ${MAX_SCENARIOS}.`);
  const scenarios = raw.scenarios.map(normalizeScenario);
  const ids = new Set(scenarios.map(scenario => scenario.id));
  if (ids.size !== scenarios.length) throw new Error('В файле повторяются ID расчётов.');
  const activeId = raw.activeId === null ? null : str(raw.activeId, 'Текущий расчёт', 150, false);
  if (activeId !== null && !ids.has(activeId)) throw new Error('Текущий расчёт не найден в файле.');
  if (!Array.isArray(raw.compareIds) || raw.compareIds.length > MAX_SCENARIOS) throw new Error('Некорректный список сравнения.');
  const compareIds = [...new Set(raw.compareIds.map(id => str(id, 'ID сравнения', 150, false)))];
  if (compareIds.some(id => !ids.has(id))) throw new Error('В сравнении указан отсутствующий расчёт.');
  return {schemaVersion: 1, scenarios, activeId, compareIds};
}

function storageOrDefault(storage) {
  const result = storage === undefined ? globalThis.localStorage : storage;
  if (!result || typeof result.getItem !== 'function' || typeof result.setItem !== 'function') throw new Error('Хранилище браузера недоступно. Скачайте резервную копию перед закрытием.');
  return result;
}
function withinLimit(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error('Файл должен быть текстовым JSON размером до 5 МБ.');
}

export function loadState(storage) {
  let raw = null;
  try {
    raw = storageOrDefault(storage).getItem(STORAGE_KEY);
    if (raw === null) return {ok: true, state: null, error: null};
    withinLimit(raw);
    return {ok: true, state: normalizeState(JSON.parse(raw)), error: null};
  } catch (error) {
    return failure(`Не удалось прочитать сохранённые расчёты: ${error.message}`, {state: null, raw});
  }
}

export function saveState(state, storage) {
  try {
    const target = storageOrDefault(storage);
    const text = JSON.stringify(normalizeState(state));
    withinLimit(text);
    const existing = target.getItem(STORAGE_KEY);
    if (existing !== null) {
      try { withinLimit(existing); normalizeState(JSON.parse(existing)); }
      catch { return failure('Сохранённые данные повреждены или имеют другую версию. Они сохранены без изменений; скачайте текущий расчёт в JSON.', {code: 'existing_corrupt'}); }
    }
    // setItem is atomic: a quota error leaves the old value intact.
    target.setItem(STORAGE_KEY, text);
    return {ok: true, error: null};
  } catch (error) {
    return failure(`Не удалось сохранить изменения на устройстве: ${error.message}. Скачайте резервную копию.`, {code: 'save_failed'});
  }
}

export function exportBackup(state, now = new Date()) {
  const text = JSON.stringify({application: APP, schemaVersion: 1, exportedAt: now.toISOString(), state: normalizeState(state)}, null, 2);
  withinLimit(text);
  return text;
}

export function parseBackup(text) {
  try {
    withinLimit(text);
    const parsed = object(JSON.parse(text.replace(/^\uFEFF/, '')), 'Файл');
    const isEnvelope = own(parsed, 'state');
    if (isEnvelope && (parsed.application !== APP || parsed.schemaVersion !== 1)) throw new Error('Это не резервная копия калькулятора «Причуды» версии 1.');
    return {ok: true, state: normalizeState(isEnvelope ? parsed.state : parsed), error: null};
  } catch (error) { return failure(`Импорт не выполнен: ${error.message}`, {state: null}); }
}

let fallbackSequence = 0;
function newId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${++fallbackSequence}-${Math.random().toString(36).slice(2)}`}`;
}
export function mergeImportedState(current, incoming) {
  const before = normalizeState(current);
  const source = normalizeState(incoming);
  if (before.scenarios.length + source.scenarios.length > MAX_SCENARIOS) throw new Error(`После импорта будет больше ${MAX_SCENARIOS} расчётов.`);
  const map = new Map();
  const imported = source.scenarios.map(scenario => {
    const id = newId('import'); map.set(scenario.id, id);
    return {...scenario, id, name: `${scenario.name.slice(0, 288)} (импорт)`,
      lines: scenario.lines.map(line => ({...line, id: newId('line')})),
    };
  });
  return {...before, scenarios: [...before.scenarios, ...imported],
    activeId: map.get(source.activeId) ?? before.activeId ?? imported[0]?.id ?? null,
    compareIds: before.compareIds,
  };
}

export function csvCell(value) {
  if (value === null || value === undefined) return '"Не указано"';
  if (typeof value === 'number') return Number.isFinite(value) ? `"${String(value).replace('.', ',')}"` : '"Не рассчитано"';
  let text = String(value);
  // Prevent spreadsheet formula evaluation even when a formula starts after whitespace.
  if (/^[\s\uFEFF]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function exportScenarioCsv(scenario, result) {
  const s = normalizeScenario(scenario);
  const bases = {unit: 'На единицу', batch: 'На партию', month: 'На месяц'};
  const stages = {produced: 'Изготовленные', good: 'Годные'};
  const rows = [
    ['Причуды', 'Калькулятор себестоимости'], ['Расчёт', s.name],
    ['Изделие', s.product === 'mittens' ? 'Варежки: одна единица = пара' : 'Чехол: одна единица = штука'],
    ['Демонстрационные данные', s.demo ? 'Да, цены условные' : 'Нет'],
    ['Количество изготовленных', s.quantity], ['Брак, %', s.defectPercent], ['Период, месяцев', s.months],
    ['Цена до скидки, ₽', s.price], ['Скидка, %', s.discountPercent], ['Доля отгрузки, %', s.sellThroughPercent],
    ['Возвраты, %', s.returnPercent], ['Комиссия, %', s.commissionPercent], ['Эквайринг, %', s.acquiringPercent],
    ['Реклама на отгрузку, ₽', s.advertisingPerOrder], ['Доставка на отгрузку, ₽', s.deliveryPerOrder],
    ['Расход на один возврат, ₽', s.returnCost], ['Налоговая база', {none: 'Не учитывать', revenue: 'Выручка', profit: 'Прибыль'}[s.taxMode]],
    ['Ставка налога, %', s.taxPercent], ['Целевая маржа, %', s.targetMarginPercent], ['Денежный резерв, %', s.reservePercent], [],
    ['Включено', 'Категория', 'Статья', 'База', 'Стадия', 'Единица цены', 'Цена, ₽', 'Расход', 'Запас, %', 'На партию, ₽', 'На годную единицу, ₽', 'Поставщик', 'Заметки'],
  ];
  const computed = new Map((result?.rows ?? []).map(line => [line.id, line]));
  const categoryNames = new Map((result?.categoryTotals ?? []).map(category => [category.id, category.label]));
  for (const line of s.lines) {
    const value = computed.get(line.id);
    rows.push([line.enabled ? 'Да' : 'Нет', categoryNames.get(line.category) ?? line.category, line.title, bases[line.basis], stages[line.stage],
      line.unit, line.rate, line.consumption, line.wastePercent, value?.total, value?.perUnit, line.supplier, line.notes]);
  }
  rows.push([], ['ИТОГИ', result?.complete ? 'Затраты заполнены' : 'Неполный расчёт'],
    ['Известные затраты, ₽', result?.knownTotal], ['Всего затрат на партию, ₽', result?.totalCost],
    ['Годных единиц', result?.goodUnits], ['Себестоимость годной единицы, ₽', result?.unitCost],
    ['Бюджет с денежным резервом, ₽', result?.budgetWithReserve], ['Удержанных продаж', result?.soldUnits],
    ['Выручка, ₽', result?.revenue], ['Расходы продаж, ₽', result?.sellingCosts], ['Налог, ₽', result?.tax],
    ['Результат партии, ₽', result?.profit], ['Маржа партии, %', result?.marginPercent], ['Наценка, %', result?.markupPercent],
    ['Цена без убытка до скидки, ₽', result?.minPrice], ['Цена для целевой маржи до скидки, ₽', result?.targetPrice],
    ['Продаж для покрытия партии', result?.breakEvenUnits], ['Заметки', s.notes]);
  if (result?.errors?.length) rows.push(['Ошибки', result.errors.join('; ')]);
  if (result?.warnings?.length) rows.push(['Пояснения', result.warnings.join('; ')]);
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n') + '\r\n';
}
