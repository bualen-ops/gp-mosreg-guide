/**
 * Shared data layer for GP pocket guide + dashboard (same Google Sheets sources).
 */
(function () {
  const GOOGLE_SHEET_CSV_URL =
    "https://docs.google.com/spreadsheets/d/1mib0hQuuvrcS2aEzXnB-Thum7Q1MkCJfXv952PmZ5Sk/gviz/tq?tqx=out:csv&gid=2000408560";
  const GOOGLE_SHEET_EXTRA_CSV_URL =
    "https://docs.google.com/spreadsheets/d/1hTOtAs6hxNJ__tHFgpKsZEolg4QDryHUEd-rt0d5fiQ/gviz/tq?tqx=out:csv&gid=0";

  const FIELD_MAP = {
    Субсидия: "subsidy",
    "Фед. субсидия": "federalSubsidy",
    ОМСУ: "region",
    "Наименование объекта": "objectName",
    "Вид работ": "workType",
    "Тип объекта": "objectType",
    Вводные: "intro",
    "Срок реализации": "timeline",
    "Год ввода": "commissioningYear",
    Охват: "coverage",
    "Мощность, куб.м./сут": "capacityPerDay",
    "Протяженность, метр": "lengthMeters",
    "Перенос срока по объекту (да/нет)": "deadlineShift",
    "Стадия готовности %": "readinessPercent",
    "Комментарий руководителей проектов": "managerComment",
    "Лимит на 2025-2028 годы Итого": "limit2025to2028",
    "Итого 2026 Итого": "total2026",
    "Наличие ПСД (да, нет, не требуется)": "psdAvailability",
    "МОГЭ № положительного заключения МОГЭ": "mogePositiveNumber",
    "Сметная стоимость (по заключению МОГЭ)": "estimateByMoge",
    "в т.ч. ПИР": "pirPart",
    "Наличие МОГЭ ( да, нет, не требуется)": "mogeAvailability",
    "Наличие МОГЭ (да, нет, не требуется)": "mogeAvailability",
    "планируемая дата выхода из МОГЭ (для объектов находящихся в МОГЭ)": "mogePlannedDate",
    "Дата заключения контракта": "contractSignedAt",
    "№ контракта": "contractNumber",
    "Подрядная организация": "contractor",
    "Подрядная \nорганизация": "contractor",
  };

  function normalizeValue(value) {
    if (value === null || value === undefined) return null;
    const compact = String(value).replace(/\s+/g, " ").trim();
    if (!compact) return null;
    const numeric = Number(compact.replace(",", "."));
    if (!Number.isNaN(numeric) && compact.match(/^-?\d+([.,]\d+)?$/)) {
      return Number.isInteger(numeric) ? numeric : numeric;
    }
    return compact;
  }

  function normalizeRegion(value) {
    const normalized = normalizeValue(value);
    if (!normalized) return null;
    const text = String(normalized).trim();
    if (/^\d+$/.test(text)) return null;
    if (/links national/i.test(text)) return null;
    if (!/[А-Яа-яЁё]/.test(text)) return null;
    return text;
  }

  function normalizeCommissioningYear(value) {
    const normalized = normalizeValue(value);
    if (normalized === null || normalized === undefined || normalized === "") return null;
    const text = String(normalized).trim();
    const year = Number(text);
    if (!Number.isInteger(year)) return null;
    if (year < 2000 || year > 2100) return null;
    return year;
  }

  function normalizeObjectKey(value) {
    const normalized = normalizeValue(value);
    if (!normalized) return "";
    return String(normalized)
      .toLowerCase()
      .replaceAll("ё", "е")
      .replace(/["'`«»]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isContracted(contractNumber) {
    if (contractNumber === null || contractNumber === undefined) return false;
    const text = String(contractNumber).replace(/\s+/g, " ").trim();
    if (!text) return false;
    const normalized = text.replace(",", ".").replace(/\s/g, "");
    if (/^0+([.]0+)?$/.test(normalized)) return false;
    return true;
  }

  function normalizeContractNumber(value) {
    const normalized = normalizeValue(value);
    if (!isContracted(normalized)) return null;
    return String(normalized).trim();
  }

  function normalizeContractor(value) {
    const normalized = normalizeValue(value);
    if (normalized === null || normalized === undefined) return null;
    const text = String(normalized).trim();
    if (!text) return null;
    if (/^0+([.,]0+)?$/.test(text.replace(/\s/g, ""))) return null;
    return text;
  }

  function normalizePercent(value) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(String(value).replace("%", "").replace(",", ".").trim());
    if (Number.isNaN(parsed)) return null;
    return Math.max(0, Math.min(100, parsed));
  }

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];

      if (char === "\"") {
        if (inQuotes && next === "\"") {
          cell += "\"";
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (!inQuotes && char === ",") {
        row.push(cell);
        cell = "";
        continue;
      }

      if (!inQuotes && (char === "\n" || char === "\r")) {
        if (char === "\r" && next === "\n") i += 1;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
        continue;
      }

      cell += char;
    }

    if (cell.length || row.length) {
      row.push(cell);
      rows.push(row);
    }

    return rows;
  }

  function buildRecord(raw) {
    const record = {};
    for (const [src, dst] of Object.entries(FIELD_MAP)) {
      if (raw[src] !== undefined) {
        record[dst] = normalizeValue(raw[src]);
      }
    }
    record.contractNumber = normalizeContractNumber(record.contractNumber);
    record.contractor = normalizeContractor(record.contractor);
    record.region = normalizeRegion(raw["ОМСУ"] ?? raw["ОМСУ "]);
    record.commissioningYear = normalizeCommissioningYear(raw["Год ввода"] ?? raw["Год ввода "]);

    const objectName = record.objectName;
    if (!objectName) return null;

    const searchableParts = [
      record.region,
      record.objectName,
      record.workType,
      record.objectType,
      record.contractNumber,
      record.contractor,
    ].filter(Boolean);
    record.searchText = searchableParts.join(" ").toLowerCase();
    return record;
  }

  async function fetchWithTimeout(url, timeoutMs = 15000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(url, { cache: "no-store", signal: ctrl.signal });
    } catch (e) {
      if (e && e.name === "AbortError") {
        throw new Error(`Таймаут загрузки (${Math.round(timeoutMs / 1000)} с): ${url}`);
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  function mapAccentObject(it) {
    const objectName = normalizeValue(it.name);
    if (!objectName) return null;
    const region = it.region && it.region !== "—" ? normalizeRegion(it.region) : null;
    const direction = it.direction && it.direction !== "—" ? normalizeValue(it.direction) : null;
    const rp = it.rp && it.rp !== "не назначен" ? normalizeValue(it.rp) : null;
    const limit = Number(it.limitThs);
    const sheetContract = normalizeContractNumber(it.sheetContract);
    const accentContract = normalizeContractNumber(it.contractNumber);
    const contractNumber = sheetContract || accentContract;
    const accentMoge = it.moge && it.moge !== "Не в МОГЭ" ? normalizeValue(it.moge) : null;
    const record = {
      objectName,
      region,
      direction,
      workType: normalizeValue(it.workType),
      objectType: normalizeValue(it.objectType),
      intro: it.movk ? "Мособлводоканал" : (normalizeValue(it.intro) || normalizeValue(it.categories) || direction),
      timeline: normalizeValue(it.timeline),
      commissioningYear: normalizeCommissioningYear(it.year),
      readinessPercent: it.progress == null || it.progress === ""
        ? normalizePercent(it.readinessPercent)
        : normalizePercent(it.progress),
      deadlineShift: normalizeValue(it.deadlineShift),
      managerComment: normalizeValue(it.comment) || normalizeValue(it.managerComment),
      extraComment: normalizeValue(it.extraComment),
      contractNumber,
      contractSignedAt: normalizeValue(it.contractSignedAt),
      contractor: normalizeContractor(it.contractor) || normalizeContractor(it.sheetContractor),
      extraManager: rp || normalizeValue(it.sheetManager),
      psdAvailability: normalizeValue(it.psdAvailability),
      mogeAvailability: normalizeValue(it.mogeAvailability) || accentMoge,
      mogePlannedDate: normalizeValue(it.mogePlannedDate),
      mogePositiveNumber: normalizeValue(it.mogePositiveNumber),
      estimateByMoge: normalizeValue(it.estimateByMoge),
      pirPart: normalizeValue(it.pirPart),
      limit2025to2028: Number.isFinite(limit) ? `${Math.round(limit).toLocaleString("ru-RU")} тыс. руб.` : normalizeValue(it.sheetLimit),
      total2026: normalizeValue(it.total2026),
      subsidy: it.movk ? "Мособлводоканал" : normalizeValue(it.subsidy),
      federalSubsidy: normalizeValue(it.federalSubsidy),
      coverage: normalizeValue(it.coverage),
      capacityPerDay: normalizeValue(it.capacityPerDay),
      lengthMeters: normalizeValue(it.lengthMeters),
      eventCode: normalizeValue(it.uin),
    };
    record.searchText = [
      record.region,
      record.objectName,
      record.workType,
      record.objectType,
      record.contractNumber,
      record.contractor,
      record.eventCode,
      record.extraManager,
      record.intro,
    ].filter(Boolean).join(" ").toLowerCase();
    return record;
  }

  async function loadFromAccent() {
    // Prefer deep passport DB built from Accent cards; fall back to compact snapshot.
    const urls = ["./accent-db.json?v=20261026b", "./accent-objects.json?v=20261026b"];
    let json = null;
    let used = "";
    for (const url of urls) {
      try {
        const response = await fetchWithTimeout(url, 20000);
        if (!response.ok) continue;
        json = await response.json();
        used = url;
        break;
      } catch (e) {
        /* try next */
      }
    }
    if (!json) throw new Error("Accent DB недоступна");

    const rawItems = json.items || json.objects || [];
    const items = rawItems
      .map((it) => {
        // accent-db items are already in handbook shape
        if (it.objectName) {
          const record = { ...it };
          record.contractNumber = normalizeContractNumber(record.contractNumber);
          record.contractor = normalizeContractor(record.contractor);
          if (!record.searchText) {
            record.searchText = [
              record.region,
              record.objectName,
              record.address,
              record.workType,
              record.objectType,
              record.contractNumber,
              record.contractor,
              record.eventCode,
              record.extraManager,
              record.managerComment,
            ].filter(Boolean).join(" ").toLowerCase();
          }
          return record.objectName ? record : null;
        }
        return mapAccentObject(it);
      })
      .filter(Boolean);

    if (!items.length) throw new Error("Accent: пустой реестр");

    return {
      source: json.source || "Акцент · глубокие карточки",
      updatedAt: json.updatedAt || "",
      used,
      items,
      regions: json.regions || Array.from(new Set(items.map((x) => x.region).filter(Boolean))).sort(),
      years: json.years || Array.from(
        new Set(items.map((x) => x.commissioningYear).filter((y) => y !== null && y !== undefined && y !== "")),
      ).sort((a, b) => Number(a) - Number(b)),
    };
  }

  async function loadFromGoogleSheet() {
    const response = await fetchWithTimeout(GOOGLE_SHEET_CSV_URL);
    if (!response.ok) {
      throw new Error(`Google Sheets HTTP ${response.status}`);
    }

    const csvText = await response.text();
    const table = parseCSV(csvText);
    if (!table.length) {
      throw new Error("Google Sheets вернул пустой CSV");
    }

    const headers = table[0].map((h) => (h || "").trim());
    const items = [];
    for (let i = 1; i < table.length; i += 1) {
      const row = table[i];
      const raw = {};
      headers.forEach((header, idx) => {
        const value = row[idx];
        if (raw[header] === undefined) {
          raw[header] = value;
          return;
        }
        if (header === "№ контракта") {
          const current = raw[header];
          const currentContracted = isContracted(current);
          const nextContracted = isContracted(value);
          if (!currentContracted && nextContracted) {
            raw[header] = value;
          }
          return;
        }
        const currentText = String(raw[header] ?? "").trim();
        const nextText = String(value ?? "").trim();
        if (!currentText && nextText) {
          raw[header] = value;
        }
      });
      const record = buildRecord(raw);
      if (record) items.push(record);
    }

    try {
      const extraResponse = await fetchWithTimeout(GOOGLE_SHEET_EXTRA_CSV_URL, 10000);
      if (extraResponse.ok) {
        const extraCsvText = await extraResponse.text();
        const extraTable = parseCSV(extraCsvText);
        if (extraTable.length > 1) {
          const extraHeaders = extraTable[0].map((h) => (h || "").trim());
          const nameIdx = extraHeaders.findIndex((h) => h === "Наименование объекта");
          const rIdx = 17;
          const sIdx = 18;

          const extraByObject = new Map();
          for (let j = 1; j < extraTable.length; j += 1) {
            const erow = extraTable[j];
            const objectName = nameIdx >= 0 ? erow[nameIdx] : erow[6];
            const key = normalizeObjectKey(objectName);
            if (!key) continue;

            const extraManager = normalizeValue(erow[rIdx]);
            const extraComment = normalizeValue(erow[sIdx]);
            if (!extraManager && !extraComment) continue;

            extraByObject.set(key, { extraManager, extraComment });
          }

          for (const item of items) {
            const key = normalizeObjectKey(item.objectName);
            const extra = extraByObject.get(key);
            if (!extra) continue;
            item.extraManager = extra.extraManager || null;
            item.extraComment = extra.extraComment || null;
          }
        }
      }
    } catch (e) {
      /* ignore */
    }

    return {
      items,
      regions: Array.from(new Set(items.map((x) => x.region).filter(Boolean))).sort(),
      years: Array.from(
        new Set(items.map((x) => x.commissioningYear).filter((y) => y !== null && y !== undefined && y !== "")),
      ).sort((a, b) => Number(a) - Number(b)),
    };
  }

  window.GpGuide = {
    loadFromAccent,
    loadFromGoogleSheet,
    isContracted,
    normalizeObjectKey,
    normalizePercent,
    normalizeValue,
  };
})();
