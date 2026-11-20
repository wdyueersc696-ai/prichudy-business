/** Pure planning arithmetic. All input prices are user quotes or explicit demo values. */
export const PRODUCT_TYPES = [
  { id: 'mittens', label: 'Варежки', unit: 'пара', plural: 'пар' },
  { id: 'cover', label: 'Чехол на коляску', unit: 'шт.', plural: 'шт.' },
];

export const CATEGORIES = [
  { id: 'materials', label: 'Материалы и печать', color: '#4e947b' },
  { id: 'production', label: 'Пошив и сборка', color: '#7c79b6' },
  { id: 'packaging', label: 'Упаковка', color: '#d6a15a' },
  { id: 'development', label: 'Подготовка и запуск', color: '#619bb0' },
  { id: 'logistics', label: 'Доставка и склад', color: '#bf7f78' },
  { id: 'overhead', label: 'Постоянные расходы', color: '#8e98a4' },
];

const id = () => globalThis.crypto?.randomUUID?.() || `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
export function cloneScenario(value) {
  const copy = JSON.parse(JSON.stringify(value));
  copy.id = id();
  copy.lines = copy.lines.map(row => ({ ...row, id: id() }));
  return copy;
}

export function createLine(category = 'materials') {
  return {
    id: id(), category, title: 'Своя статья затрат', unit: 'усл.', rate: null,
    consumption: 1, wastePercent: 0, basis: 'unit', stage: category === 'packaging' ? 'good' : 'produced',
    enabled: true, supplier: '', notes: '',
  };
}

function line(category, title, { unit = 'усл.', basis = 'unit', stage = 'produced',
  enabled = true, consumption = 1, notes = '' } = {}) {
  return { ...createLine(category), title, unit, basis, stage, enabled, consumption, notes };
}

function templateLines(product) {
  const m = (title, unit, notes = '', enabled = true) => line('materials', title, { unit, consumption: null, notes, enabled });
  const b = (category, title, enabled = false, notes = '') => line(category, title, { basis: 'batch', enabled, notes });
  const p = (title, enabled = false) => line('packaging', title, { unit: 'шт.', stage: 'good', enabled });
  const monthly = (title, notes = '') => line('overhead', title, { basis: 'month', enabled: false, notes });
  const materials = [
    m('Ткань верха', 'м', 'Укажите расход на пару / один чехол по раскладке. Если цена уже с печатью, отдельную печать выключите.'),
    m('Печать на ткани', 'м', 'Не дублируйте стоимость печати, включённую в цену ткани.'),
    m('Подкладка', 'м'), m('Утеплитель', 'м'), m('Резинка', 'м'),
    m('Нитки и мелкие расходники', 'компл.', 'Можно указать готовую оценку расходников на единицу.'),
    m('Вшивная этикетка / составник', 'шт.'),
  ];
  if (product === 'cover') materials.push(
    m('Прозрачное окно', 'м²'), m('Молния и бегунки', 'компл.'),
    m('Липучка', 'м'), m('Светоотражающая лента', 'м'),
    m('Ремешки и фиксаторы', 'компл.', '', false), m('Вентиляционная сетка', 'м²', '', false),
  );
  else materials.push(m('Шнур / держатель', 'м', '', false), m('Съёмные крепления', 'шт.', '', false));
  return [...materials,
    line('production', 'Раскрой', { notes: 'Отключите, если включён в цену пошива.' }),
    line('production', 'Пошив и сборка', { notes: 'Цена за ПАРУ варежек или за один чехол. Уточните состав услуги.' }),
    line('production', 'Установка фурнитуры', { enabled: false }),
    line('production', 'Контроль качества', { enabled: false }),
    line('production', 'Доработка / исправление брака', { enabled: false, notes: 'Расход на доработку. Брак в параметрах партии уменьшает выход годных изделий отдельно.' }),
    b('production', 'Доплата до минимального заказа', false, 'Только доплата сверх рассчитанного заказа. Не вписывайте сюда всю сумму минимального заказа повторно.'),
    p('Коробка / основная упаковка', true), p('Защитный пакет', true), p('Тишью / наполнитель'),
    p('Обечайка / брендирование коробки'), p('Наклейка / пломба'), p('Карточка / инструкция'),
    p('Маркировка / код / нанесение'), p('Сборка упаковки'),
    b('development', 'Дизайн принта'), b('development', 'Лекала / конструирование', true),
    b('development', 'Пошив первого образца', true), b('development', 'Примерка и корректировка лекал'),
    b('development', 'Цветопроба / тест печати'), b('development', 'Подготовка печатного файла'),
    b('development', 'Испытания / документы / маркировка', false, 'Фактическая смета применимых услуг. Этот калькулятор не определяет требования к изделию.'),
    b('development', 'Съёмка / контент / карточки товара'),
    b('logistics', 'Доставка материалов', true), b('logistics', 'Перевозка между подрядчиками'),
    b('logistics', 'Приёмка / доставка партии на склад'), b('logistics', 'Поездки / курьер / образцы'),
    monthly('Аренда / склад / коммунальные услуги'), monthly('Зарплата / работа владельца', 'Укажите только долю оплаты, относящуюся к этой партии.'),
    monthly('Взносы / обязательные платежи', 'Только доля за выбранный период. Не дублируйте один платёж в нескольких изделиях.'),
    monthly('Бухгалтерия'), monthly('Банк / касса / ОФД'), monthly('Сайт / связь / подписки'),
    monthly('Оборудование / ремонт / амортизация'), monthly('Прочие постоянные расходы'),
  ];
}

export function createScenario(product = 'mittens', options = {}) {
  if (!PRODUCT_TYPES.some(p => p.id === product)) product = 'mittens';
  const demo = !!options.demo;
  const scenario = {
    id: id(), name: demo ? 'Пример расчёта' : 'Новый расчёт', product, demo,
    quantity: 50, defectPercent: 0, months: 1, reservePercent: 0,
    price: null, discountPercent: 0, targetMarginPercent: 30,
    sellThroughPercent: 100, returnPercent: 0, commissionPercent: 0, acquiringPercent: 0,
    advertisingPerOrder: 0, deliveryPerOrder: 0, returnCost: 0,
    taxMode: 'none', taxPercent: 0, notes: '', lines: templateLines(product),
  };
  if (!demo) return scenario;
  Object.assign(scenario, {
    name: product === 'cover' ? 'Чехол · пример' : 'Варежки · пример',
    quantity: 50, defectPercent: 2, months: 2, reservePercent: 10,
    price: product === 'cover' ? 7990 : 3490,
    sellThroughPercent: 90, returnPercent: 4, commissionPercent: 12, acquiringPercent: 2,
    advertisingPerOrder: 180, deliveryPerOrder: 80, returnCost: 160,
    notes: 'Условные числа для знакомства с калькулятором. Это не цены поставщиков и не подтверждённый расход материалов.',
  });
  const rates = {
    'Ткань верха': [650, product === 'cover' ? 2.2 : 0.18],
    'Печать на ткани': [350, product === 'cover' ? 2.2 : 0.18],
    'Подкладка': [400, product === 'cover' ? 2.2 : 0.18],
    'Утеплитель': [380, product === 'cover' ? 2.2 : 0.18],
    'Резинка': [24, product === 'cover' ? 1.8 : 0.45],
    'Нитки и мелкие расходники': [12, 1], 'Вшивная этикетка / составник': [10, 1],
    'Прозрачное окно': [450, 0.2], 'Молния и бегунки': [170, 1],
    'Липучка': [55, 0.5], 'Светоотражающая лента': [28, 1.5],
    'Раскрой': [product === 'cover' ? 180 : 45, 1],
    'Пошив и сборка': [product === 'cover' ? 1100 : 330, 1],
    'Коробка / основная упаковка': [70, 1], 'Защитный пакет': [12, 1],
    'Лекала / конструирование': [product === 'cover' ? 8000 : 5000, 1],
    'Пошив первого образца': [product === 'cover' ? 3500 : 1800, 1],
    'Доставка материалов': [900, 1],
  };
  for (const row of scenario.lines) {
    if (row.enabled && rates[row.title]) {
      [row.rate, row.consumption] = rates[row.title];
      row.wastePercent = row.category === 'materials' && row.unit === 'м' ? 5 : 0;
    }
  }
  return scenario;
}

export function parseNumber(value) {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return null;
  if (typeof value !== 'string' && typeof value !== 'number') return NaN;
  const n = typeof value === 'number' ? value : Number(value.trim().replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

function finite(value) { return Number.isFinite(value) ? value : null; }

/** Expected units can be fractional: this is a forecast, not a physical packing list. */
export function calculate(scenario = {}) {
  const errors = [], warnings = [], missingLines = [];
  const read = (value, title, { min = 0, max = 1e9, integer = false, required = true } = {}) => {
    const n = parseNumber(value);
    if (n === null) {
      if (required) errors.push(`Заполните: ${title}.`);
      return null;
    }
    if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
      errors.push(`Проверьте значение: ${title}.`); return null;
    }
    return n;
  };
  const valueOrDefault = (key, fallback) => scenario[key] === undefined ? fallback : scenario[key];
  const percent = (key, label, max = 99.99) => read(valueOrDefault(key, 0), label, { max });
  const quantity = read(scenario.quantity, 'размер партии', { min: 1, max: 1000000, integer: true });
  const defect = percent('defectPercent', 'брак');
  const months = read(valueOrDefault('months', 1), 'период в месяцах', { max: 1200 });
  const reservePercent = percent('reservePercent', 'резерв бюджета', 1000);
  const discount = percent('discountPercent', 'скидка');
  const target = read(valueOrDefault('targetMarginPercent', 30), 'целевая маржа', { max: 99.99 });
  const sellThrough = percent('sellThroughPercent', 'доля отправленных изделий', 100);
  const returns = percent('returnPercent', 'возвраты');
  const commission = percent('commissionPercent', 'комиссия');
  const acquiring = percent('acquiringPercent', 'эквайринг');
  const taxPercent = percent('taxPercent', 'налоговая ставка');
  const taxMode = ['none', 'revenue', 'profit'].includes(scenario.taxMode) ? scenario.taxMode : 'none';
  if (scenario.taxMode && !['none', 'revenue', 'profit'].includes(scenario.taxMode)) errors.push('Неизвестный способ расчёта налога.');
  const price = read(scenario.price, 'цена продажи', { required: false });
  const advertising = read(valueOrDefault('advertisingPerOrder', 0), 'реклама на отправленный заказ');
  const delivery = read(valueOrDefault('deliveryPerOrder', 0), 'доставка на отправленный заказ');
  const returnCost = read(valueOrDefault('returnCost', 0), 'дополнительные расходы на возврат');
  const good = quantity !== null && defect !== null ? quantity * (1 - defect / 100) : null;
  const shipped = good !== null && sellThrough !== null ? good * sellThrough / 100 : null;
  const returned = shipped !== null && returns !== null ? shipped * returns / 100 : null;
  const sold = shipped !== null && returned !== null ? shipped - returned : null;
  const sourceLines = Array.isArray(scenario.lines) ? scenario.lines : [];
  if (!Array.isArray(scenario.lines)) errors.push('Список затрат повреждён.');
  const rows = sourceLines.map(source => {
    const row = source && typeof source === 'object' ? source : {};
    if (!row.enabled) return { ...row, total: 0, perUnit: 0, amount: 0, missing: false };
    const title = row.title || 'Статья без названия';
    const category = CATEGORIES.find(c => c.id === row.category);
    if (!category) errors.push(`Неизвестная категория: ${title}.`);
    const rate = read(row.rate, `цена — ${title}`, { required: false });
    const consumption = read(row.consumption, `расход — ${title}`, { required: false });
    const waste = read(row.wastePercent === undefined ? 0 : row.wastePercent, `запас — ${title}`, { max: 1000 });
    if (!['unit', 'batch', 'month'].includes(row.basis)) errors.push(`Неизвестная база расчёта: ${title}.`);
    if (!['produced', 'good'].includes(row.stage)) errors.push(`Неизвестная база единиц: ${title}.`);
    let multiplier = row.basis === 'batch' ? 1 : row.basis === 'month' ? months : row.stage === 'good' ? good : quantity;
    const noQuantity = multiplier === 0 || consumption === 0;
    const missing = !noQuantity && (rate === null || consumption === null);
    if (missing) missingLines.push(title);
    const total = noQuantity ? 0 : [rate, consumption, waste, multiplier].every(v => v !== null)
      ? finite(rate * consumption * (1 + waste / 100) * multiplier) : null;
    if (total === null && !missing && [rate, consumption, waste, multiplier].every(v => v !== null)) errors.push(`Слишком большое значение: ${title}.`);
    return { ...row, category: category?.id || row.category, total, amount: total,
      perUnit: total !== null && good > 0 ? finite(total / good) : null, missing };
  });
  const activeRows = rows.filter(r => r.enabled);
  if (!activeRows.length) warnings.push('В смете нет включённых затрат.');
  const categoryTotals = CATEGORIES.map(category => {
    const items = activeRows.filter(row => row.category === category.id);
    const knownTotal = items.reduce((sum, row) => sum + (row.total ?? 0), 0);
    return { ...category, knownTotal, total: items.every(r => r.total !== null) ? knownTotal : null,
      missingCount: items.filter(r => r.missing).length };
  });
  const knownTotal = finite(activeRows.reduce((sum, row) => sum + (row.total ?? 0), 0));
  if (knownTotal === null) errors.push('Сумма затрат слишком велика.');
  const valid = errors.length === 0;
  const complete = valid && missingLines.length === 0 && activeRows.every(r => r.total !== null);
  const totalCost = complete ? knownTotal : null;
  const unitCost = totalCost !== null && good > 0 ? finite(totalCost / good) : null;
  const sumCategories = ids => complete ? activeRows.filter(r => ids.includes(r.category)).reduce((sum, r) => sum + r.total, 0) : null;
  const salePrice = price !== null && discount !== null ? finite(price * (1 - discount / 100)) : null;
  const revenue = valid && salePrice !== null && sold !== null ? finite(salePrice * sold) : null;
  const fixedSellingCosts = valid ? finite(shipped * (advertising + delivery) + returned * returnCost) : null;
  const sellingCosts = revenue !== null ? finite(revenue * ((commission + acquiring) / 100) + fixedSellingCosts) : null;
  const salesComplete = complete && revenue !== null && sellingCosts !== null;
  const profitBeforeTax = salesComplete ? finite(revenue - totalCost - sellingCosts) : null;
  const tax = profitBeforeTax !== null ? taxMode === 'revenue' ? revenue * taxPercent / 100
    : taxMode === 'profit' ? Math.max(0, profitBeforeTax) * taxPercent / 100 : 0 : null;
  const profit = profitBeforeTax !== null && tax !== null ? finite(profitBeforeTax - tax) : null;
  const netFraction = commission !== null && acquiring !== null ? 1 - (commission + acquiring) / 100 - (taxMode === 'revenue' ? taxPercent / 100 : 0) : null;
  const cashPerRetained = valid ? (advertising + delivery + returns / 100 * returnCost) / (1 - returns / 100) : null;
  const proceedsPerRetained = valid && salePrice !== null ? finite(salePrice * netFraction - cashPerRetained) : null;
  const variableCost = complete ? activeRows.filter(r => r.basis === 'unit').reduce((sum, r) => sum + r.total, 0) : null;
  const variableCostPerGood = variableCost !== null && good > 0 ? variableCost / good : null;
  const contributionPerSold = proceedsPerRetained !== null && variableCostPerGood !== null ? finite(proceedsPerRetained - variableCostPerGood) : null;
  const maximumRetainedUnits = good !== null && returns !== null ? good * (1 - returns / 100) : null;
  const breakEvenUnits = complete && proceedsPerRetained > 0 ? Math.ceil(totalCost / proceedsPerRetained - 1e-10) : null;
  const breakEvenReachable = breakEvenUnits !== null && maximumRetainedUnits !== null ? breakEvenUnits <= maximumRetainedUnits : false;
  const selectedPlanBreakEvenReachable = breakEvenUnits !== null && sold !== null ? breakEvenUnits <= sold : false;
  const requiredPrice = margin => {
    if (!complete || !(sold > 0) || discount === null || !(discount < 100)) return null;
    const denominator = taxMode === 'profit'
      ? 1 - (commission + acquiring) / 100 - margin / (1 - taxPercent / 100)
      : netFraction - margin;
    if (!(denominator > 0)) return null;
    return finite((totalCost + fixedSellingCosts) / sold / denominator / (1 - discount / 100));
  };
  const minPrice = requiredPrice(0);
  const targetPrice = requiredPrice(target / 100);
  const maxAdvertisingPerOrder = complete && revenue !== null && shipped > 0
    ? finite((revenue * netFraction - totalCost - shipped * delivery - returned * returnCost) / shipped) : null;
  const reserve = totalCost !== null ? finite(totalCost * reservePercent / 100) : null;
  if (missingLines.length) warnings.push(`Не заполнены включённые статьи: ${missingLines.length}. Полная себестоимость пока неизвестна.`);
  if (complete && totalCost === 0) warnings.push('Сумма включённых затрат равна нулю. Проверьте смету.');
  if (valid && sold === 0) warnings.push('Нет сохранённых продаж в этом сценарии. Цена окупаемости и маржа не рассчитываются.');
  if (valid && netFraction <= 0) warnings.push('Комиссии и налоговый резерв поглощают всю выручку. Окупаемость при этих ставках невозможна.');
  if (complete && sold > 0 && targetPrice === null) warnings.push('Целевая маржа недостижима при заданных процентных удержаниях.');
  if (complete && breakEvenUnits !== null && !breakEvenReachable) warnings.push('Текущей партии недостаточно для возврата всех затрат при этой цене.');
  if (taxMode === 'none') warnings.push('Налоги в расчёт не включены.');
  return {
    valid, complete, costComplete: complete, salesComplete, errors, warnings,
    missingCount: missingLines.length, missingLines, rows, categoryTotals,
    producedUnits: quantity, goodUnits: finite(good), rejectedUnits: quantity !== null && good !== null ? finite(quantity - good) : null,
    shippedUnits: finite(shipped), returnedUnits: finite(returned), soldUnits: finite(sold),
    remainingUnits: good !== null && sold !== null ? finite(good - sold) : null,
    maximumRetainedUnits: finite(maximumRetainedUnits), knownTotal, totalCost, unitCost,
    productionCost: sumCategories(['materials', 'production', 'packaging', 'logistics']),
    launchCost: sumCategories(['development']), overheadCost: sumCategories(['overhead']),
    variableCost, fixedCost: totalCost !== null && variableCost !== null ? totalCost - variableCost : null,
    reserve, budgetWithReserve: totalCost !== null && reserve !== null ? finite(totalCost + reserve) : null,
    salePrice, revenue, sellingCosts, fixedSellingCosts, tax: finite(tax), profitBeforeTax, profit,
    profitPerSold: profit !== null && sold > 0 ? finite(profit / sold) : null,
    marginPercent: profit !== null && revenue > 0 ? finite(profit / revenue * 100) : null,
    markupPercent: salePrice !== null && unitCost > 0 ? finite((salePrice - unitCost) / unitCost * 100) : null,
    contributionPerSold, minPrice, targetPrice, breakEvenUnits, breakEvenReachable,
    selectedPlanBreakEvenReachable, maxAdvertisingPerOrder,
  };
}

export function quantityScenarios(scenario, quantities = [50, 100, 300]) {
  return quantities.map(quantity => ({ quantity, result: calculate({ ...scenario, quantity }) }));
}
