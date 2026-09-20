import { t as createClient } from "../assets/supabase-D_AYc1Jo.js";

(() => {
  "use strict";

  const DB_NAME = "auguste-checklist";
  const DB_VERSION = 3;
  const FALLBACK_KEY = "auguste-checklist-fallback-v1";
  const CHANNEL_NAME = "auguste-checklist-sync";
  const APP_BUILD_ID = "2026-09-20-live-sync-v3";
  const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  const QUICK_TARGET_ORDER = [
    "cuisineToday",
    "cuisineTomorrow",
    "salleToday",
    "salleTomorrow",
    "maintenance",
    "bring",
  ];
  const REORDER_HOLD_DELAY = 450;
  const REORDER_MOVE_TOLERANCE = 9;
  const REORDER_EDGE_ZONE = 96;
  const REORDER_MAX_SCROLL_SPEED = 14;
  const SUPABASE_URL = "https://eoewkjfgqivrkkgpjsrk.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_b9sZUgW7Sr2WItAxEqCoyw_gc-xoJyl";
  const SHARED_SECTION = "checklist";
  const ITEMS_TABLE = "auguste_checklist_items";
  const MUTATIONS_TABLE = "auguste_checklist_mutations";
  const LEGACY_MIGRATION_KEY = "durable-sync-v2-imported";
  const REVISION_META_PREFIX = "sync-head:";
  const FALLBACK_SYNC_INTERVAL_MS = 15_000;
  const HISTORY_TIME_ZONE = "Europe/Paris";
  const HISTORY_DAY_KEY_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
    timeZone: HISTORY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const HISTORY_DAY_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
    timeZone: HISTORY_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const HISTORY_CALENDAR_DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
    timeZone: HISTORY_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const HISTORY_TIME_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
    timeZone: HISTORY_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
  const CLIENT_INSTANCE_ID = crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const DEVICE_ID = persistentDeviceId();
  const DEFAULT_SETTINGS = {
    id: "preferences",
    quickTarget: "cuisineToday",
    autoMorning: false,
    autoEvening: false,
  };

  const elements = {
    currentDate: document.querySelector("#currentDate"),
    cuisineTodayList: document.querySelector("#cuisineTodayList"),
    cuisineTomorrowList: document.querySelector("#cuisineTomorrowList"),
    salleTodayList: document.querySelector("#salleTodayList"),
    salleTomorrowList: document.querySelector("#salleTomorrowList"),
    bringList: document.querySelector("#bringList"),
    bringAddForm: document.querySelector("#bringAddForm"),
    bringInput: document.querySelector("#bringInput"),
    maintenanceToggle: document.querySelector("#maintenanceToggle"),
    maintenancePanel: document.querySelector("#maintenancePanel"),
    maintenanceList: document.querySelector("#maintenanceList"),
    cuisineTodayProgress: document.querySelector("#cuisineTodayProgress"),
    cuisineTomorrowProgress: document.querySelector("#cuisineTomorrowProgress"),
    salleTodayProgress: document.querySelector("#salleTodayProgress"),
    salleTomorrowProgress: document.querySelector("#salleTomorrowProgress"),
    bringProgress: document.querySelector("#bringProgress"),
    maintenanceProgress: document.querySelector("#maintenanceProgress"),
    quickAddForm: document.querySelector("#quickAddForm"),
    quickInput: document.querySelector("#quickInput"),
    quickTarget: document.querySelector("#quickTarget"),
    quickEstimate: document.querySelector("#quickEstimate"),
    emptyAddCuisineToday: document.querySelector("#emptyAddCuisineToday"),
    emptyAddCuisineTomorrow: document.querySelector("#emptyAddCuisineTomorrow"),
    emptyAddSalleToday: document.querySelector("#emptyAddSalleToday"),
    emptyAddSalleTomorrow: document.querySelector("#emptyAddSalleTomorrow"),
    emptyAddMaintenance: document.querySelector("#emptyAddMaintenance"),
    taskTemplate: document.querySelector("#taskTemplate"),
    settingsDialog: document.querySelector("#settingsDialog"),
    settingsContent: document.querySelector("#settingsDialog .sheet-content"),
    settingsTitle: document.querySelector("#settingsTitle"),
    settingsMainView: document.querySelector("#settingsMainView"),
    openSettings: document.querySelector("#openSettings"),
    closeSettings: document.querySelector("#closeSettings"),
    backToSettings: document.querySelector("#backToSettings"),
    openHistory: document.querySelector("#openHistory"),
    historyView: document.querySelector("#historyView"),
    historySummary: document.querySelector("#historySummary"),
    historyList: document.querySelector("#historyList"),
    morningTemplateList: document.querySelector("#morningTemplateList"),
    eveningTemplateList: document.querySelector("#eveningTemplateList"),
    autoMorning: document.querySelector("#autoMorning"),
    autoEvening: document.querySelector("#autoEvening"),
    addMorningToday: document.querySelector("#addMorningToday"),
    addEveningToday: document.querySelector("#addEveningToday"),
    exportData: document.querySelector("#exportData"),
    importDataButton: document.querySelector("#importDataButton"),
    importData: document.querySelector("#importData"),
    clearCompleted: document.querySelector("#clearCompleted"),
    installApp: document.querySelector("#installApp"),
    taskDialog: document.querySelector("#taskDialog"),
    editTaskForm: document.querySelector("#editTaskForm"),
    editTaskLabel: document.querySelector("#editTaskLabel"),
    taskListFieldset: document.querySelector("#taskListFieldset"),
    momentFieldset: document.querySelector("#momentFieldset"),
    editEstimate: document.querySelector("#editEstimate"),
    editEstimateValue: document.querySelector("#editEstimateValue"),
    closeTaskDialog: document.querySelector("#closeTaskDialog"),
    deleteTask: document.querySelector("#deleteTask"),
    durationDialog: document.querySelector("#durationDialog"),
    closeDurationDialog: document.querySelector("#closeDurationDialog"),
    clearDuration: document.querySelector("#clearDuration"),
    customDurationForm: document.querySelector("#customDurationForm"),
    customDurationInput: document.querySelector("#customDurationInput"),
    toast: document.querySelector("#toast"),
    toastMessage: document.querySelector("#toastMessage"),
    toastAction: document.querySelector("#toastAction"),
    toastDismiss: document.querySelector("#toastDismiss"),
    syncStatus: document.querySelector("#syncStatus"),
    syncStatusDetail: document.querySelector("#syncStatusDetail"),
  };

  const state = {
    tasks: [],
    history: [],
    templates: [],
    occurrences: [],
    settings: { ...DEFAULT_SETTINGS },
    activeTaskId: null,
    quickEstimateMinutes: null,
    editEstimateMinutes: null,
    durationTarget: null,
    lastDateKey: "",
    maintenanceOpen: false,
  };

  let deferredInstallPrompt = null;
  let toastTimer = null;
  let databasePromise = null;
  let appStarted = false;
  let durableStorageAvailable = null;
  let sharedReady = false;
  let sharedSaving = false;
  let sharedSaveTimer = null;
  let sharedChannel = null;
  let sharedChannelStatus = "CLOSED";
  let syncInFlight = null;
  let syncAgain = false;
  let pendingRemoteRefresh = false;
  let syncWarningShown = false;
  let reorderGesture = null;
  let reorderPersisting = false;
  let reorderAutoScrollFrame = null;
  let suppressedTaskClickId = null;
  let suppressedTaskClickTimer = null;
  let lastTouchStartedAt = 0;
  let pendingLocalRefresh = false;
  let localMutationVersion = 0;
  const optimisticRevisions = new Map();
  const syncChannel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    realtime: {
      // A Web Worker keeps heartbeats reliable when iOS throttles the page.
      worker: "Worker" in window,
      heartbeatIntervalMs: 15_000,
      heartbeatCallback: (status) => {
        if (status !== "timeout" && status !== "disconnected") return;
        sharedChannelStatus = "CONNECTING";
        scheduleSharedSave(0);
        void updateSyncStatus();
      },
    },
  });

  function makeId(prefix) {
    if (crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function makeUuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const bytes = new Uint8Array(16);
    if (crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return window.CSS.escape(String(value));
    return [...String(value)].map((character) => (
      /[a-zA-Z0-9_-]/.test(character)
        ? character
        : `\\${character.codePointAt(0).toString(16)} `
    )).join("");
  }

  function persistentDeviceId() {
    const key = "auguste-checklist-device-id";
    try {
      const existing = localStorage.getItem(key);
      if (existing) return existing;
      const value = makeUuid();
      localStorage.setItem(key, value);
      return value;
    } catch {
      return CLIENT_INSTANCE_ID;
    }
  }

  function toDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function dateFromKey(key) {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }

  function shiftDateKey(key, amount) {
    const date = dateFromKey(key);
    date.setDate(date.getDate() + amount);
    return toDateKey(date);
  }

  function todayKey() {
    return toDateKey(new Date());
  }

  function tomorrowKey() {
    return shiftDateKey(todayKey(), 1);
  }

  function historyDateKey(date = new Date()) {
    const parts = Object.fromEntries(
      HISTORY_DAY_KEY_FORMATTER
        .formatToParts(date)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function historyDayLabel(date) {
    const key = historyDateKey(date);
    const currentKey = historyDateKey(new Date());
    const calendarDate = HISTORY_CALENDAR_DATE_FORMATTER.format(date);
    if (key === currentKey) return `Aujourd’hui · ${calendarDate}`;
    if (key === shiftDateKey(currentKey, -1)) return `Hier · ${calendarDate}`;
    const label = HISTORY_DAY_FORMATTER.format(date);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function historyTimeLabel(date) {
    return HISTORY_TIME_FORMATTER.format(date).replace(":", " h ");
  }

  function openDatabase() {
    if (!("indexedDB" in window)) return Promise.resolve(null);
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains("tasks")) {
          const tasks = database.createObjectStore("tasks", { keyPath: "id" });
          tasks.createIndex("dueDate", "dueDate", { unique: false });
        }
        if (!database.objectStoreNames.contains("templates")) {
          database.createObjectStore("templates", { keyPath: "id" });
        }
        if (!database.objectStoreNames.contains("settings")) {
          database.createObjectStore("settings", { keyPath: "id" });
        }
        if (!database.objectStoreNames.contains("occurrences")) {
          database.createObjectStore("occurrences", { keyPath: "id" });
        }
        if (!database.objectStoreNames.contains("outbox")) {
          const outbox = database.createObjectStore("outbox", { keyPath: "id" });
          outbox.createIndex("createdAt", "createdAt", { unique: false });
        }
        if (!database.objectStoreNames.contains("meta")) {
          database.createObjectStore("meta", { keyPath: "id" });
        }
      };

      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          databasePromise = null;
        };
        resolve(database);
      };
      request.onerror = () => resolve(null);
      request.onblocked = () => showToast("Ferme l’autre onglet puis recharge");
    });
  }

  function getDatabase() {
    if (!databasePromise) databasePromise = openDatabase();
    return databasePromise;
  }

  function readFallback() {
    try {
      const parsed = JSON.parse(localStorage.getItem(FALLBACK_KEY) || "{}");
      return {
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        history: Array.isArray(parsed.history) ? parsed.history : [],
        templates: Array.isArray(parsed.templates) ? parsed.templates : [],
        settings: Array.isArray(parsed.settings) ? parsed.settings : [],
        occurrences: Array.isArray(parsed.occurrences) ? parsed.occurrences : [],
        outbox: Array.isArray(parsed.outbox) ? parsed.outbox : [],
        meta: Array.isArray(parsed.meta) ? parsed.meta : [],
      };
    } catch {
      return {
        tasks: [],
        history: [],
        templates: [],
        settings: [],
        occurrences: [],
        outbox: [],
        meta: [],
      };
    }
  }

  function writeFallback(data) {
    if (appStarted) {
      throw new Error(
        "Le stockage IndexedDB est indisponible : écriture bloquée pour protéger les données.",
      );
    }
    try {
      localStorage.setItem(FALLBACK_KEY, JSON.stringify(data));
    } catch (error) {
      throw new Error("Le stockage local est indisponible.", { cause: error });
    }
  }

  async function getAllRecords(storeName) {
    const database = await getDatabase();
    if (!database) return readFallback()[storeName];
    return new Promise((resolve, reject) => {
      const request = database.transaction(storeName, "readonly").objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  function entityTypeForStore(storeName) {
    return {
      tasks: "task",
      templates: "template",
      occurrences: "occurrence",
      settings: "setting",
    }[storeName] || null;
  }

  function mutationPayload(storeName, record) {
    const { _syncRevision: ignoredSyncRevision, ...shareableRecord } = record || {};
    if (storeName === "settings") {
      return {
        id: "preferences",
        autoMorning: Boolean(record?.autoMorning),
        autoEvening: Boolean(record?.autoEvening),
        updatedAt: record?.updatedAt || new Date().toISOString(),
      };
    }
    return record && typeof record === "object" ? shareableRecord : {};
  }

  function mutationEntityKey(entityType, entityId) {
    return `${entityType}:${entityId}`;
  }

  function revisionMetaRecord(entityType, entityId, revision) {
    return {
      id: `${REVISION_META_PREFIX}${entityType}:${entityId}`,
      entityType,
      entityId,
      revision: syncRevision(revision),
      recordedAt: new Date().toISOString(),
    };
  }

  function rememberRevisionMeta(records) {
    for (const record of records || []) {
      if (!record?.id?.startsWith(REVISION_META_PREFIX)) continue;
      if (!record.entityType || !record.entityId) continue;
      const entityKey = mutationEntityKey(record.entityType, record.entityId);
      optimisticRevisions.set(entityKey, Math.max(
        syncRevision(optimisticRevisions.get(entityKey)),
        syncRevision(record.revision),
      ));
    }
  }

  function rememberOutboxRevisions(outbox) {
    for (const mutation of outbox || []) {
      const entityKey = mutationEntityKey(mutation.entityType, mutation.entityId);
      optimisticRevisions.set(entityKey, Math.max(
        syncRevision(optimisticRevisions.get(entityKey)),
        syncRevision(mutation.baseRevision) + 1,
      ));
    }
  }

  function syncRevision(value) {
    return Number.isInteger(value) && value >= 0 ? value : 0;
  }

  function makeMutation(storeName, record, action = "upsert", options = {}) {
    const entityType = entityTypeForStore(storeName);
    const entityId = typeof record?.id === "string" ? record.id : "";
    if (!entityType || !entityId) return null;
    const entityKey = mutationEntityKey(entityType, entityId);
    const recordRevision = syncRevision(record?._syncRevision);
    const hadOptimisticRevision = optimisticRevisions.has(entityKey);
    const previousOptimisticRevision = optimisticRevisions.get(entityKey);
    const hasForcedBase = Number.isInteger(options.baseRevision) && options.baseRevision >= 0;
    const baseRevision = hasForcedBase
      ? options.baseRevision
      : Math.max(recordRevision, syncRevision(previousOptimisticRevision));
    const hadRecordRevision = Object.prototype.hasOwnProperty.call(record, "_syncRevision");
    const mutation = {
      id: makeUuid(),
      entityType,
      entityId,
      action,
      payload: mutationPayload(storeName, record),
      deviceId: DEVICE_ID,
      createdAt: new Date().toISOString(),
      baseRevision,
      optimisticRevision: baseRevision + 1,
      previousOptimisticRevision,
      hadOptimisticRevision,
      previousRecordRevision: record?._syncRevision,
      hadRecordRevision,
      record,
      attempts: 0,
    };
    optimisticRevisions.set(entityKey, mutation.optimisticRevision);
    record._syncRevision = mutation.optimisticRevision;
    return mutation;
  }

  function rollbackMutations(mutations) {
    for (const mutation of [...mutations].filter(Boolean).reverse()) {
      const entityKey = mutationEntityKey(mutation.entityType, mutation.entityId);
      if (optimisticRevisions.get(entityKey) === mutation.optimisticRevision) {
        if (mutation.hadOptimisticRevision) {
          optimisticRevisions.set(entityKey, mutation.previousOptimisticRevision);
        } else {
          optimisticRevisions.delete(entityKey);
        }
      }
      if (mutation.record) {
        if (mutation.hadRecordRevision) {
          mutation.record._syncRevision = mutation.previousRecordRevision;
        } else {
          delete mutation.record._syncRevision;
        }
      }
    }
  }

  function outboxMutation(mutation) {
    if (!mutation) return null;
    const {
      optimisticRevision,
      previousOptimisticRevision,
      hadOptimisticRevision,
      previousRecordRevision,
      hadRecordRevision,
      record,
      ...persisted
    } = mutation;
    return persisted;
  }

  function putMutationInFallback(data, mutation) {
    if (!mutation) return;
    const persistedMutation = outboxMutation(mutation);
    const index = data.outbox.findIndex((item) => item.id === mutation.id);
    if (index >= 0) data.outbox[index] = persistedMutation;
    else data.outbox.push(persistedMutation);
  }

  function putMutationInTransaction(transaction, mutation) {
    if (mutation) transaction.objectStore("outbox").put(outboxMutation(mutation));
  }

  async function queueMutations(mutations, metaRecord = null) {
    const validMutations = mutations.filter(Boolean);
    try {
      const database = await getDatabase();
      if (!database) {
        const data = readFallback();
        for (const mutation of validMutations) putMutationInFallback(data, mutation);
        if (metaRecord) {
          data.meta = data.meta.filter((item) => item.id !== metaRecord.id);
          data.meta.push(metaRecord);
        }
        writeFallback(data);
        return;
      }
      const storeNames = ["outbox"];
      if (metaRecord) storeNames.push("meta");
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(storeNames, "readwrite");
        for (const mutation of validMutations) putMutationInTransaction(transaction, mutation);
        if (metaRecord) transaction.objectStore("meta").put(metaRecord);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error("File d’attente annulée"));
      });
    } catch (error) {
      rollbackMutations(validMutations);
      throw error;
    }
  }

  async function acknowledgeOutboxMutation(mutation, revision) {
    const headRecord = revisionMetaRecord(
      mutation.entityType,
      mutation.entityId,
      revision,
    );
    const database = await getDatabase();
    if (!database) {
      const data = readFallback();
      data.outbox = data.outbox.filter((item) => item.id !== mutation.id);
      data.meta = data.meta.filter((item) => item.id !== headRecord.id);
      data.meta.push(headRecord);
      writeFallback(data);
      return;
    }
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(["outbox", "meta"], "readwrite");
      transaction.objectStore("outbox").delete(mutation.id);
      transaction.objectStore("meta").put(headRecord);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Accusé de réception annulé"));
    });
  }

  async function putOutboxRecord(mutation) {
    const persistedMutation = outboxMutation(mutation);
    const database = await getDatabase();
    if (!database) {
      const data = readFallback();
      const index = data.outbox.findIndex((item) => item.id === mutation.id);
      if (index >= 0) data.outbox[index] = persistedMutation;
      else data.outbox.push(persistedMutation);
      writeFallback(data);
      return;
    }
    return new Promise((resolve, reject) => {
      const transaction = database.transaction("outbox", "readwrite");
      transaction.objectStore("outbox").put(persistedMutation);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(
        transaction.error || new Error("Mise à jour de synchronisation annulée"),
      );
    });
  }

  async function getMetaRecord(id) {
    const database = await getDatabase();
    if (!database) return readFallback().meta.find((item) => item.id === id) || null;
    return new Promise((resolve, reject) => {
      const request = database.transaction("meta", "readonly").objectStore("meta").get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function putRecord(storeName, record, { share = true } = {}) {
    const mutation = share ? makeMutation(storeName, record, "upsert") : null;
    try {
      const database = await getDatabase();
      if (!database) {
        const data = readFallback();
        const index = data[storeName].findIndex((item) => item.id === record.id);
        if (index >= 0) data[storeName][index] = record;
        else data[storeName].push(record);
        putMutationInFallback(data, mutation);
        writeFallback(data);
        return;
      }
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(
          mutation ? [storeName, "outbox"] : [storeName],
          "readwrite",
        );
        transaction.objectStore(storeName).put(record);
        putMutationInTransaction(transaction, mutation);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error("Écriture annulée"));
      });
    } catch (error) {
      rollbackMutations([mutation]);
      throw error;
    }
  }

  async function putTaskWithHistory(task, historyEntry = null) {
    const historyRecord = historyEntry ? historyCompatibilityRecord(historyEntry) : null;
    const taskMutation = makeMutation("tasks", task, "upsert");
    const historyMutation = historyRecord
      ? makeMutation("occurrences", historyRecord, "upsert")
      : null;
    try {
      const database = await getDatabase();
      if (!database) {
      const data = readFallback();
      const taskIndex = data.tasks.findIndex((item) => item.id === task.id);
      if (taskIndex >= 0) data.tasks[taskIndex] = task;
      else data.tasks.push(task);
      if (historyEntry) {
        const historyIndex = data.history.findIndex((item) => item.id === historyEntry.id);
        if (historyIndex >= 0) data.history[historyIndex] = historyEntry;
        else data.history.push(historyEntry);
        const compatibilityRecord = historyRecord;
        const occurrenceIndex = data.occurrences.findIndex(
          (item) => item.id === compatibilityRecord.id,
        );
        if (occurrenceIndex >= 0) data.occurrences[occurrenceIndex] = compatibilityRecord;
        else data.occurrences.push(compatibilityRecord);
      }
      putMutationInFallback(data, taskMutation);
      putMutationInFallback(data, historyMutation);
        writeFallback(data);
        if (historyEntry) historyEntry._syncRevision = historyRecord._syncRevision;
        return;
      }
      await new Promise((resolve, reject) => {
        const storeNames = historyEntry
          ? ["tasks", "occurrences", "outbox"]
          : ["tasks", "outbox"];
        const transaction = database.transaction(storeNames, "readwrite");
        transaction.objectStore("tasks").put(task);
        if (historyEntry) {
          transaction.objectStore("occurrences").put(historyRecord);
        }
        putMutationInTransaction(transaction, taskMutation);
        putMutationInTransaction(transaction, historyMutation);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error("Écriture annulée"));
      });
      if (historyEntry) historyEntry._syncRevision = historyRecord._syncRevision;
    } catch (error) {
      rollbackMutations([taskMutation, historyMutation]);
      throw error;
    }
  }

  async function putHistoryRecord(historyEntry) {
    const compatibilityRecord = historyCompatibilityRecord(historyEntry);
    const mutation = makeMutation("occurrences", compatibilityRecord, "upsert");
    try {
      const database = await getDatabase();
      if (!database) {
      const data = readFallback();
      const index = data.history.findIndex((item) => item.id === historyEntry.id);
      if (index >= 0) data.history[index] = historyEntry;
      else data.history.push(historyEntry);
      const occurrenceIndex = data.occurrences.findIndex(
        (item) => item.id === compatibilityRecord.id,
      );
      if (occurrenceIndex >= 0) data.occurrences[occurrenceIndex] = compatibilityRecord;
      else data.occurrences.push(compatibilityRecord);
      putMutationInFallback(data, mutation);
        writeFallback(data);
        historyEntry._syncRevision = compatibilityRecord._syncRevision;
        return;
      }
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(["occurrences", "outbox"], "readwrite");
        transaction.objectStore("occurrences").put(compatibilityRecord);
        putMutationInTransaction(transaction, mutation);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error("Écriture annulée"));
      });
      historyEntry._syncRevision = compatibilityRecord._syncRevision;
    } catch (error) {
      rollbackMutations([mutation]);
      throw error;
    }
  }

  async function updateTaskOrderRecords(taskIds, positionBase, updatedAt) {
    if (!taskIds.length) return [];
    const mutations = [];
    try {
      const database = await getDatabase();
      if (!database) {
        const data = readFallback();
        const positions = new Map(taskIds.map((id, index) => [id, positionBase + index]));
        const updatedRecords = [];
        data.tasks = data.tasks.map((task) => {
          if (!positions.has(task.id)) return task;
          const updatedTask = {
            ...task,
            manualPosition: positions.get(task.id),
            updatedAt,
          };
          const mutation = makeMutation("tasks", updatedTask, "upsert");
          mutations.push(mutation);
          updatedRecords.push(updatedTask);
          putMutationInFallback(data, mutation);
          return updatedTask;
        });
        writeFallback(data);
        return updatedRecords;
      }
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction(["tasks", "outbox"], "readwrite");
        const store = transaction.objectStore("tasks");
        const updatedRecords = [];
        taskIds.forEach((id, index) => {
          const request = store.get(id);
          request.onsuccess = () => {
            if (!request.result) return;
            const updatedTask = {
              ...request.result,
              manualPosition: positionBase + index,
              updatedAt,
            };
            const mutation = makeMutation("tasks", updatedTask, "upsert");
            mutations.push(mutation);
            updatedRecords.push(updatedTask);
            store.put(updatedTask);
            putMutationInTransaction(transaction, mutation);
          };
        });
        transaction.oncomplete = () => resolve(updatedRecords);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error("Écriture annulée"));
      });
    } catch (error) {
      rollbackMutations(mutations);
      throw error;
    }
  }

  async function deleteRecord(storeName, id, record = null) {
    const mutation = makeMutation(storeName, record || { id }, "delete");
    try {
      const database = await getDatabase();
      if (!database) {
      const data = readFallback();
      data[storeName] = data[storeName].filter((item) => item.id !== id);
      putMutationInFallback(data, mutation);
        writeFallback(data);
        return;
      }
      await new Promise((resolve, reject) => {
        const transaction = database.transaction([storeName, "outbox"], "readwrite");
        transaction.objectStore(storeName).delete(id);
        putMutationInTransaction(transaction, mutation);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error("Suppression annulée"));
      });
    } catch (error) {
      rollbackMutations([mutation]);
      throw error;
    }
  }

  async function replaceAllData(nextState) {
    const database = await getDatabase();
    if (!database) {
      const history = nextState.history || [];
      const existing = readFallback();
      writeFallback({
        tasks: nextState.tasks,
        history,
        templates: nextState.templates,
        settings: [nextState.settings],
        occurrences: [
          ...(nextState.occurrences || []),
          ...history.map(historyCompatibilityRecord),
        ],
        outbox: existing.outbox,
        meta: existing.meta,
      });
      return;
    }

    return new Promise((resolve, reject) => {
      const storeNames = ["tasks", "templates", "settings", "occurrences"];
      const transaction = database.transaction(storeNames, "readwrite");
      for (const storeName of storeNames) transaction.objectStore(storeName).clear();
      for (const task of nextState.tasks) transaction.objectStore("tasks").put(task);
      for (const historyEntry of nextState.history || []) {
        transaction.objectStore("occurrences").put(historyCompatibilityRecord(historyEntry));
      }
      for (const template of nextState.templates) transaction.objectStore("templates").put(template);
      for (const occurrence of nextState.occurrences || []) {
        transaction.objectStore("occurrences").put(occurrence);
      }
      transaction.objectStore("settings").put(nextState.settings);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Restauration annulée"));
    });
  }

  function storedRecordsToState(records) {
    const occurrenceRecords = records.occurrences || [];
    return {
      tasks: (records.tasks || []).map(normalizeTask).filter((task) => task.label),
      history: mergeCompletionHistory(occurrenceRecords.filter(isHistoryRecord)),
      templates: (records.templates || [])
        .map(normalizeTemplate)
        .filter((template) => template.label),
      occurrences: occurrenceRecords
        .filter((record) => !isHistoryRecord(record))
        .map(normalizeOccurrence)
        .filter(Boolean),
      settings: normalizeSettings(
        (records.settings || []).find((item) => item.id === "preferences"),
      ),
    };
  }

  async function replaceRemoteDataWithOutbox(rows) {
    const headRecords = (rows || []).map((row) => revisionMetaRecord(
      row.entity_type,
      row.entity_id,
      row.revision,
    ));
    const database = await getDatabase();
    if (!database) {
      const existing = readFallback();
      const localState = storedRecordsToState(existing);
      const remoteState = remoteItemsToState(rows, localState);
      const nextState = applyOutboxToState(remoteState, existing.outbox);
      const nextRecords = stateStoreRecords(nextState);
      const metaMap = new Map(
        [...existing.meta, ...headRecords].map((record) => [record.id, record]),
      );
      writeFallback({
        ...nextRecords,
        history: nextState.history || [],
        outbox: existing.outbox,
        meta: [...metaMap.values()],
      });
      return;
    }

    return new Promise((resolve, reject) => {
      // Include the outbox in the same read/write transaction as the local
      // projection. IndexedDB then serializes this reconciliation with every
      // concurrent tab mutation: it can never clear a record without also
      // seeing and replaying the mutation that created it.
      const storeNames = ["tasks", "templates", "settings", "occurrences", "outbox", "meta"];
      const transaction = database.transaction(storeNames, "readwrite");
      const results = {};
      let remainingRequests = storeNames.length;
      const finishRead = () => {
        remainingRequests -= 1;
        if (remainingRequests) return;
        try {
          const localState = storedRecordsToState(results);
          const remoteState = remoteItemsToState(rows, localState);
          const nextState = applyOutboxToState(remoteState, results.outbox || []);
          const nextRecords = stateStoreRecords(nextState);
          for (const storeName of ["tasks", "templates", "settings", "occurrences"]) {
            const store = transaction.objectStore(storeName);
            store.clear();
            for (const record of nextRecords[storeName]) store.put(record);
          }
          const metaStore = transaction.objectStore("meta");
          for (const headRecord of headRecords) metaStore.put(headRecord);
        } catch (error) {
          transaction.abort();
          reject(error);
        }
      };
      for (const storeName of storeNames) {
        const request = transaction.objectStore(storeName).getAll();
        request.onsuccess = () => {
          results[storeName] = request.result || [];
          finishRead();
        };
        request.onerror = () => reject(request.error);
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(
        transaction.error || new Error("Réconciliation locale annulée"),
      );
    });
  }

  function stateStoreRecords(snapshot) {
    const historyRecords = (snapshot.history || []).map(historyCompatibilityRecord);
    const occurrenceMap = new Map(
      [...(snapshot.occurrences || []), ...historyRecords].map((record) => [record.id, record]),
    );
    return {
      tasks: snapshot.tasks || [],
      templates: snapshot.templates || [],
      settings: [snapshot.settings || { ...DEFAULT_SETTINGS }],
      occurrences: [...occurrenceMap.values()],
    };
  }

  async function replaceAllDataWithMutations(nextState, previousState) {
    const nextRecords = stateStoreRecords(nextState);
    const previousRecords = stateStoreRecords(previousState);
    const mutations = [];
    for (const storeName of ["tasks", "templates", "occurrences", "settings"]) {
      const nextIds = new Set(nextRecords[storeName].map((record) => record.id));
      for (const record of previousRecords[storeName]) {
        if (!nextIds.has(record.id)) {
          mutations.push(makeMutation(storeName, record, "delete"));
        }
      }
      for (const record of nextRecords[storeName]) {
        mutations.push(makeMutation(storeName, record, "upsert"));
      }
    }

    try {
      const database = await getDatabase();
      if (!database) {
        const existing = readFallback();
        writeFallback({
          ...nextRecords,
          history: nextState.history || [],
          outbox: [
            ...existing.outbox,
            ...mutations.filter(Boolean).map(outboxMutation),
          ],
          meta: existing.meta,
        });
        return;
      }
      await new Promise((resolve, reject) => {
        const storeNames = ["tasks", "templates", "settings", "occurrences", "outbox"];
        const transaction = database.transaction(storeNames, "readwrite");
        for (const storeName of ["tasks", "templates", "settings", "occurrences"]) {
          const store = transaction.objectStore(storeName);
          store.clear();
          for (const record of nextRecords[storeName]) store.put(record);
        }
        for (const mutation of mutations) putMutationInTransaction(transaction, mutation);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error("Restauration annulée"));
      });
    } catch (error) {
      rollbackMutations(mutations);
      throw error;
    }
  }

  async function deleteTaskWithOccurrence(task) {
    const occurrence = task.occurrenceKey
      ? { id: task.occurrenceKey, dismissedAt: new Date().toISOString() }
      : null;
    const mutations = [makeMutation("tasks", task, "delete")];
    if (occurrence) mutations.push(makeMutation("occurrences", occurrence, "upsert"));
    try {
      const database = await getDatabase();
      if (!database) {
        const data = readFallback();
        data.tasks = data.tasks.filter((item) => item.id !== task.id);
        if (occurrence) {
          data.occurrences = data.occurrences.filter((item) => item.id !== occurrence.id);
          data.occurrences.push(occurrence);
        }
        for (const mutation of mutations) putMutationInFallback(data, mutation);
        writeFallback(data);
        return occurrence;
      }
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(["tasks", "occurrences", "outbox"], "readwrite");
        transaction.objectStore("tasks").delete(task.id);
        if (occurrence) transaction.objectStore("occurrences").put(occurrence);
        for (const mutation of mutations) putMutationInTransaction(transaction, mutation);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error("Suppression annulée"));
      });
      return occurrence;
    } catch (error) {
      rollbackMutations(mutations);
      throw error;
    }
  }

  async function restoreTaskWithOccurrence(task) {
    const occurrenceRecord = task.occurrenceKey ? { id: task.occurrenceKey } : null;
    const mutations = [makeMutation("tasks", task, "upsert")];
    if (occurrenceRecord) {
      mutations.push(makeMutation("occurrences", occurrenceRecord, "delete"));
    }
    try {
      const database = await getDatabase();
      if (!database) {
        const data = readFallback();
        data.tasks = data.tasks.filter((item) => item.id !== task.id);
        data.tasks.push(task);
        if (task.occurrenceKey) {
          data.occurrences = data.occurrences.filter((item) => item.id !== task.occurrenceKey);
        }
        for (const mutation of mutations) putMutationInFallback(data, mutation);
        writeFallback(data);
        return;
      }
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(["tasks", "occurrences", "outbox"], "readwrite");
        transaction.objectStore("tasks").put(task);
        if (task.occurrenceKey) transaction.objectStore("occurrences").delete(task.occurrenceKey);
        for (const mutation of mutations) putMutationInTransaction(transaction, mutation);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error("Restauration annulée"));
      });
    } catch (error) {
      rollbackMutations(mutations);
      throw error;
    }
  }

  async function deleteCompletedRecords(tasks) {
    const tombstones = tasks
      .filter((task) => task.occurrenceKey)
      .map((task) => ({ id: task.occurrenceKey, dismissedAt: new Date().toISOString() }));
    const taskIds = new Set(tasks.map((task) => task.id));
    const mutations = [
      ...tasks.map((task) => makeMutation("tasks", task, "delete")),
      ...tombstones.map((occurrence) => makeMutation("occurrences", occurrence, "upsert")),
    ];
    try {
      const database = await getDatabase();
      if (!database) {
      const data = readFallback();
      data.tasks = data.tasks.filter((task) => !taskIds.has(task.id));
      const tombstoneIds = new Set(tombstones.map((occurrence) => occurrence.id));
      data.occurrences = data.occurrences.filter((occurrence) => !tombstoneIds.has(occurrence.id));
      data.occurrences.push(...tombstones);
      for (const mutation of mutations) putMutationInFallback(data, mutation);
      writeFallback(data);
      return tombstones;
      }
      await new Promise((resolve, reject) => {
      const transaction = database.transaction(["tasks", "occurrences", "outbox"], "readwrite");
      const taskStore = transaction.objectStore("tasks");
      const occurrenceStore = transaction.objectStore("occurrences");
      for (const task of tasks) taskStore.delete(task.id);
      for (const occurrence of tombstones) occurrenceStore.put(occurrence);
      for (const mutation of mutations) putMutationInTransaction(transaction, mutation);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Suppression annulée"));
      });
      return tombstones;
    } catch (error) {
      rollbackMutations(mutations);
      throw error;
    }
  }

  async function restoreCompletedRecords(tasks) {
    const occurrenceRecords = tasks
      .filter((task) => task.occurrenceKey)
      .map((task) => ({ id: task.occurrenceKey }));
    const mutations = [
      ...tasks.map((task) => makeMutation("tasks", task, "upsert")),
      ...occurrenceRecords.map((record) => makeMutation("occurrences", record, "delete")),
    ];
    try {
      const database = await getDatabase();
      if (!database) {
      const data = readFallback();
      const restoredIds = new Set(tasks.map((task) => task.id));
      const occurrenceIds = new Set(tasks.map((task) => task.occurrenceKey).filter(Boolean));
      data.tasks = data.tasks.filter((task) => !restoredIds.has(task.id));
      data.tasks.push(...tasks);
      data.occurrences = data.occurrences.filter((occurrence) => !occurrenceIds.has(occurrence.id));
      for (const mutation of mutations) putMutationInFallback(data, mutation);
      writeFallback(data);
      return;
      }
      await new Promise((resolve, reject) => {
      const transaction = database.transaction(["tasks", "occurrences", "outbox"], "readwrite");
      const taskStore = transaction.objectStore("tasks");
      const occurrenceStore = transaction.objectStore("occurrences");
      for (const task of tasks) {
        taskStore.put(task);
        if (task.occurrenceKey) occurrenceStore.delete(task.occurrenceKey);
      }
      for (const mutation of mutations) putMutationInTransaction(transaction, mutation);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Restauration annulée"));
      });
    } catch (error) {
      rollbackMutations(mutations);
      throw error;
    }
  }

  async function createRoutineTaskIfAllowed(task, { restoreDismissed = false } = {}) {
    const mutations = [];
    try {
      const database = await getDatabase();
      if (!database) {
        const data = readFallback();
        const dismissedRecord = data.occurrences.find((item) => item.id === task.occurrenceKey);
        const exists = data.tasks.some((item) => item.id === task.id);
        if (exists || (dismissedRecord && !restoreDismissed)) return false;
        if (dismissedRecord) {
          data.occurrences = data.occurrences.filter((item) => item.id !== task.occurrenceKey);
          const occurrenceMutation = makeMutation(
            "occurrences",
            dismissedRecord,
            "delete",
          );
          mutations.push(occurrenceMutation);
          putMutationInFallback(data, occurrenceMutation);
        }
        const taskMutation = makeMutation("tasks", task, "upsert");
        mutations.push(taskMutation);
        data.tasks.push(task);
        putMutationInFallback(data, taskMutation);
        writeFallback(data);
        return true;
      }
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction(["tasks", "occurrences", "outbox"], "readwrite");
        const taskStore = transaction.objectStore("tasks");
        const occurrenceStore = transaction.objectStore("occurrences");
        let created = false;
        const occurrenceRequest = occurrenceStore.get(task.occurrenceKey);
        occurrenceRequest.onsuccess = () => {
          const dismissedRecord = occurrenceRequest.result || null;
          if (dismissedRecord && !restoreDismissed) return;
          const taskRequest = taskStore.get(task.id);
          taskRequest.onsuccess = () => {
            if (taskRequest.result) return;
            if (dismissedRecord) {
              occurrenceStore.delete(task.occurrenceKey);
              const occurrenceMutation = makeMutation(
                "occurrences",
                dismissedRecord,
                "delete",
              );
              mutations.push(occurrenceMutation);
              putMutationInTransaction(transaction, occurrenceMutation);
            }
            const taskMutation = makeMutation("tasks", task, "upsert");
            mutations.push(taskMutation);
            taskStore.put(task);
            putMutationInTransaction(transaction, taskMutation);
            created = true;
          };
        };
        transaction.oncomplete = () => resolve(created);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error("Création annulée"));
      });
    } catch (error) {
      rollbackMutations(mutations);
      throw error;
    }
  }

  function taskReorderLocked() {
    return Boolean(reorderGesture) || reorderPersisting;
  }

  function rowKey(entityType, entityId) {
    return `${entityType}:${entityId}`;
  }

  function recordTimestamp(record) {
    return Date.parse(
      record?.updatedAt ||
      record?.dismissedAt ||
      record?.completedAt ||
      record?.createdAt ||
      "",
    ) || 0;
  }

  function recordsShareSamePayload(storeName, first, second) {
    if (storeName === "settings") {
      return Boolean(first?.autoMorning) === Boolean(second?.autoMorning) &&
        Boolean(first?.autoEvening) === Boolean(second?.autoEvening);
    }
    return canonicalJson(mutationPayload(storeName, first)) ===
      canonicalJson(mutationPayload(storeName, second));
  }

  function remoteItemsToState(rows, baseState = null) {
    const startingState = baseState || {
      tasks: [],
      history: [],
      templates: [],
      occurrences: [],
      settings: { ...DEFAULT_SETTINGS },
    };
    const taskMap = new Map(startingState.tasks.map((record) => [record.id, record]));
    const templateMap = new Map(
      startingState.templates.map((record) => [record.id, record]),
    );
    const occurrenceMap = new Map(
      [
        ...startingState.occurrences,
        ...startingState.history.map(historyCompatibilityRecord),
      ].map((record) => [record.id, record]),
    );
    let sharedSettings = { ...startingState.settings };
    for (const row of rows || []) {
      if (row.workspace !== SHARED_SECTION) continue;
      const entityKey = mutationEntityKey(row.entity_type, row.entity_id);
      optimisticRevisions.set(entityKey, syncRevision(row.revision));
      const payload = row.payload;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) continue;
      const record = { ...payload, _syncRevision: syncRevision(row.revision) };
      const target = row.entity_type === "task"
        ? taskMap
        : row.entity_type === "template"
          ? templateMap
          : row.entity_type === "occurrence"
            ? occurrenceMap
            : null;
      if (target) {
        if (row.deleted_at) target.delete(row.entity_id);
        else target.set(row.entity_id, record);
      }
      if (row.entity_type === "setting" && row.entity_id === "preferences") {
        if (row.deleted_at) {
          sharedSettings = normalizeSettings({
            ...DEFAULT_SETTINGS,
            quickTarget: sharedSettings.quickTarget,
            _syncRevision: row.revision,
          });
        } else {
          sharedSettings = normalizeSettings({
            ...record,
            quickTarget: sharedSettings.quickTarget,
          });
        }
      }
    }
    const occurrenceRecords = [...occurrenceMap.values()];
    const history = mergeCompletionHistory(occurrenceRecords.filter(isHistoryRecord));
    return {
      tasks: [...taskMap.values()].map(normalizeTask).filter((task) => task.label),
      history,
      templates: [...templateMap.values()]
        .map(normalizeTemplate)
        .filter((template) => template.label),
      occurrences: occurrenceRecords
        .filter((record) => !isHistoryRecord(record))
        .map(normalizeOccurrence)
        .filter(Boolean),
      settings: sharedSettings,
    };
  }

  function compareOutboxMutations(a, b) {
    const aEntityKey = mutationEntityKey(a.entityType, a.entityId);
    const bEntityKey = mutationEntityKey(b.entityType, b.entityId);
    const entityDifference = aEntityKey.localeCompare(bEntityKey);
    if (entityDifference) return entityDifference;
    const revisionDifference = syncRevision(a.baseRevision) - syncRevision(b.baseRevision);
    if (revisionDifference) return revisionDifference;
    const timeDifference = Date.parse(a.createdAt || "") - Date.parse(b.createdAt || "");
    return timeDifference || String(a.id).localeCompare(String(b.id));
  }

  function applyOutboxToState(remoteState, outbox) {
    const taskMap = new Map(remoteState.tasks.map((record) => [record.id, record]));
    const templateMap = new Map(remoteState.templates.map((record) => [record.id, record]));
    const occurrenceMap = new Map(
      [
        ...remoteState.occurrences,
        ...remoteState.history.map(historyCompatibilityRecord),
      ].map((record) => [record.id, record]),
    );
    let settings = { ...remoteState.settings };

    const ordered = [...outbox].sort(compareOutboxMutations);
    for (const mutation of ordered) {
      const entityKey = mutationEntityKey(mutation.entityType, mutation.entityId);
      optimisticRevisions.set(
        entityKey,
        Math.max(
          syncRevision(optimisticRevisions.get(entityKey)),
          syncRevision(mutation.baseRevision) + 1,
        ),
      );
      const target = mutation.entityType === "task"
        ? taskMap
        : mutation.entityType === "template"
          ? templateMap
          : mutation.entityType === "occurrence"
            ? occurrenceMap
            : null;
      if (target) {
        if (mutation.action === "delete") target.delete(mutation.entityId);
        else {
          target.set(mutation.entityId, {
            ...mutation.payload,
            _syncRevision: syncRevision(mutation.baseRevision) + 1,
          });
        }
      } else if (mutation.entityType === "setting" && mutation.entityId === "preferences") {
        if (mutation.action !== "delete") {
          settings = normalizeSettings({
            ...settings,
            ...mutation.payload,
            quickTarget: settings.quickTarget,
            _syncRevision: syncRevision(mutation.baseRevision) + 1,
          });
        }
      }
    }

    const occurrenceRecords = [...occurrenceMap.values()];
    return {
      tasks: [...taskMap.values()].map(normalizeTask).filter((task) => task.label),
      templates: [...templateMap.values()]
        .map(normalizeTemplate)
        .filter((template) => template.label),
      history: mergeCompletionHistory(occurrenceRecords.filter(isHistoryRecord)),
      occurrences: occurrenceRecords
        .filter((record) => !isHistoryRecord(record))
        .map(normalizeOccurrence)
        .filter(Boolean),
      settings,
    };
  }

  async function loadRemoteItems() {
    const entityTypes = ["task", "template", "occurrence", "setting"];
    const pageSize = 500;
    const collections = await Promise.all(entityTypes.map(async (entityType) => {
      const rows = [];
      let cursor = "";
      while (true) {
        let query = supabase
          .from(ITEMS_TABLE)
          .select("workspace,entity_type,entity_id,payload,deleted_at,revision,mutation_id,updated_at")
          .eq("workspace", SHARED_SECTION)
          .eq("entity_type", entityType);
        if (cursor) query = query.gt("entity_id", cursor);
        query = query
          .order("entity_id", { ascending: true })
          .limit(pageSize);
        const { data, error } = await query;
        if (error) throw error;
        const page = data || [];
        rows.push(...page);
        if (page.length < pageSize) break;
        cursor = page.at(-1).entity_id;
      }
      return rows;
    }));
    return collections.flat();
  }

  async function safeguardLegacyLocalData(remoteRows) {
    const [legacyCheck, existingOutbox] = await Promise.all([
      getMetaRecord(LEGACY_MIGRATION_KEY),
      getAllRecords("outbox"),
    ]);
    const pendingEntityKeys = new Set(
      existingOutbox.map((mutation) => rowKey(mutation.entityType, mutation.entityId)),
    );
    const remoteByKey = new Map(
      (remoteRows || []).map((row) => [rowKey(row.entity_type, row.entity_id), row]),
    );
    const localRecords = [
      ...state.tasks.map((record) => ["tasks", record]),
      ...state.templates.map((record) => ["templates", record]),
      ...state.occurrences.map((record) => ["occurrences", record]),
      ...state.history.map((entry) => ["occurrences", historyCompatibilityRecord(entry)]),
      ["settings", state.settings],
    ];
    const mutations = [];
    for (const [storeName, record] of localRecords) {
      const entityType = entityTypeForStore(storeName);
      const remote = remoteByKey.get(rowKey(entityType, record.id));
      if (pendingEntityKeys.has(rowKey(entityType, record.id))) continue;
      if (remote?.deleted_at) {
        if (!legacyCheck) {
          mutations.push(makeMutation(storeName, record, "upsert", {
            baseRevision: Math.max(0, syncRevision(remote.revision) - 1),
          }));
        }
        continue;
      }
      // Missing IDs are safe creations. A divergent pre-v2 version of an
      // existing ID is journaled deliberately as a conflict: neither version
      // is allowed to overwrite the other based on an untrusted client clock.
      if (!remote) {
        mutations.push(makeMutation(storeName, record, "upsert", { baseRevision: 0 }));
      } else if (
        !legacyCheck &&
        !recordsShareSamePayload(storeName, record, remote.payload)
      ) {
        mutations.push(makeMutation(storeName, record, "upsert", {
          baseRevision: Math.max(0, syncRevision(remote.revision) - 1),
        }));
      }
    }
    await queueMutations(mutations, {
      id: LEGACY_MIGRATION_KEY,
      checkedAt: new Date().toISOString(),
      recovered: mutations.length,
      build: APP_BUILD_ID,
    });
    return mutations.length;
  }

  async function applyRemoteItems(rows) {
    if (taskReorderLocked()) {
      pendingRemoteRefresh = true;
      return;
    }
    await replaceRemoteDataWithOutbox(rows);
    await loadState({ runAutomatic: false });
    syncChannel?.postMessage({ type: "refresh", reason: "remote", at: Date.now() });
  }

  async function updateSyncStatus(forcedState = "") {
    if (!elements.syncStatus) return;
    let outbox = [];
    try {
      outbox = await getAllRecords("outbox");
    } catch {
      outbox = [{}];
    }
    const count = outbox.length;
    const conflictCount = outbox.filter((mutation) => mutation.conflict).length;
    const realtimeConnecting = sharedReady && sharedChannelStatus !== "SUBSCRIBED";
    const status = forcedState || (
      !navigator.onLine
        ? "offline"
        : sharedSaving
          ? "syncing"
          : conflictCount
            ? "conflict"
          : count
            ? "pending"
            : realtimeConnecting
              ? "connecting"
              : "synced"
    );
    const labels = {
      offline: "Hors ligne",
      connecting: "Connexion…",
      syncing: "Synchronisation…",
      pending: `${count} à envoyer`,
      conflict: `${conflictCount} conflit${conflictCount > 1 ? "s" : ""} protégé${conflictCount > 1 ? "s" : ""}`,
      error: "Sauvegardé sur cet appareil",
      storage: "Stockage indisponible",
      synced: "Synchronisé",
    };
    elements.syncStatus.textContent = labels[status] || labels.synced;
    elements.syncStatus.dataset.state = status;
    if (elements.syncStatusDetail) {
      elements.syncStatusDetail.textContent = conflictCount
        ? `${conflictCount} modification${conflictCount > 1 ? "s sont" : " est"} conservée${conflictCount > 1 ? "s" : ""} sans écraser la version d’un autre appareil.`
        : count
          ? `${count} modification${count > 1 ? "s" : ""} conservée${count > 1 ? "s" : ""} localement en attente du serveur.`
          : "Toutes les modifications sont confirmées par le serveur.";
      if (status === "connecting") {
        elements.syncStatusDetail.textContent =
          "Connexion en direct en cours. Les données restent sauvegardées et sont vérifiées automatiquement.";
      }
      if (status === "storage") {
        elements.syncStatusDetail.textContent =
          "Écriture désactivée : ce navigateur ne fournit pas le stockage sécurisé requis.";
      }
      elements.syncStatus.title = elements.syncStatusDetail.textContent;
    }
  }

  function canonicalJson(value) {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.keys(value).sort().map((key) => (
        `${JSON.stringify(key)}:${canonicalJson(value[key])}`
      )).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  function matchesStoredMutation(stored, mutation) {
    if (!stored) return false;
    const sameIdentity = stored.mutation_id === mutation.id &&
      stored.workspace === SHARED_SECTION &&
      stored.entity_type === mutation.entityType &&
      stored.entity_id === mutation.entityId &&
      stored.action === mutation.action &&
      stored.device_id === (mutation.deviceId || DEVICE_ID) &&
      Number(stored.base_revision) === syncRevision(mutation.baseRevision);
    if (!sameIdentity) return false;
    return mutation.action === "delete" ||
      canonicalJson(stored.payload) === canonicalJson(mutation.payload || {});
  }

  async function loadStoredMutation(mutationId) {
    const { data, error } = await supabase
      .from(MUTATIONS_TABLE)
      .select("mutation_id,workspace,entity_type,entity_id,action,payload,device_id,base_revision,entity_revision,outcome")
      .eq("mutation_id", mutationId)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function pushOutboxOnce() {
    const outbox = (await getAllRecords("outbox")).sort(compareOutboxMutations);
    const blockedEntities = new Set();
    for (const mutation of outbox) {
      const entityKey = mutationEntityKey(mutation.entityType, mutation.entityId);
      if (mutation.conflict) {
        blockedEntities.add(entityKey);
        continue;
      }
      if (blockedEntities.has(entityKey)) continue;

      const { data, error } = await supabase.from(MUTATIONS_TABLE).insert({
        mutation_id: mutation.id,
        workspace: SHARED_SECTION,
        entity_type: mutation.entityType,
        entity_id: mutation.entityId,
        action: mutation.action,
        payload: mutation.payload || {},
        device_id: mutation.deviceId || DEVICE_ID,
        client_created_at: mutation.createdAt || null,
        base_revision: syncRevision(mutation.baseRevision),
      }).select("mutation_id,workspace,entity_type,entity_id,action,payload,device_id,base_revision,entity_revision,outcome");
      if (error && error.code !== "23505") throw error;
      const storedMutation = data?.[0] || await loadStoredMutation(mutation.id);
      if (!matchesStoredMutation(storedMutation, mutation)) {
        throw error || new Error("Accusé de réception de mutation invalide");
      }
      if (storedMutation.outcome === "applied") {
        const appliedRevision = syncRevision(mutation.baseRevision) + 1;
        await acknowledgeOutboxMutation(mutation, appliedRevision);
        optimisticRevisions.set(
          entityKey,
          Math.max(syncRevision(optimisticRevisions.get(entityKey)), appliedRevision),
        );
        continue;
      }
      const protectedConflict = {
        ...mutation,
        conflict: true,
        conflictAt: new Date().toISOString(),
        serverEntityRevision: storedMutation.entity_revision,
      };
      await putOutboxRecord(protectedConflict);
      blockedEntities.add(entityKey);
    }
  }

  async function synchronizeSharedState() {
    if (!sharedReady || !navigator.onLine) {
      await updateSyncStatus();
      return;
    }
    if (syncInFlight) {
      syncAgain = true;
      return syncInFlight;
    }

    syncInFlight = (async () => {
      sharedSaving = true;
      let failed = false;
      await updateSyncStatus("syncing");
      try {
        do {
          syncAgain = false;
          await pushOutboxOnce();
          let remoteRows = await loadRemoteItems();
          const recovered = await safeguardLegacyLocalData(remoteRows);
          if (recovered) {
            await pushOutboxOnce();
            remoteRows = await loadRemoteItems();
          }
          if (taskReorderLocked()) pendingRemoteRefresh = true;
          else await applyRemoteItems(remoteRows);
        } while (syncAgain);
        syncWarningShown = false;
      } catch (error) {
        failed = true;
        console.error("Synchronisation différée.", error);
        if (!syncWarningShown) {
          syncWarningShown = true;
          showToast("Modifications gardées sur cet appareil");
        }
        await updateSyncStatus("error");
      } finally {
        sharedSaving = false;
        syncInFlight = null;
        await updateSyncStatus(failed ? "error" : "");
      }
    })();
    return syncInFlight;
  }

  function scheduleSharedSave(delay = 180) {
    void updateSyncStatus();
    if (!sharedReady) return;
    window.clearTimeout(sharedSaveTimer);
    sharedSaveTimer = window.setTimeout(() => void synchronizeSharedState(), delay);
  }

  function handleRemoteChecklistChange() {
    if (taskReorderLocked()) pendingRemoteRefresh = true;
    else scheduleSharedSave(25);
  }

  function subscribeToSharedState() {
    if (!sharedReady || !navigator.onLine || sharedChannel) return;
    sharedChannelStatus = "CONNECTING";
    void updateSyncStatus();

    const channel = supabase
      .channel(`chez-auguste-v3:${SHARED_SECTION}:${CLIENT_INSTANCE_ID}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: ITEMS_TABLE,
          filter: `workspace=eq.${SHARED_SECTION}`,
        },
        handleRemoteChecklistChange,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: ITEMS_TABLE,
          filter: `workspace=eq.${SHARED_SECTION}`,
        },
        handleRemoteChecklistChange,
      );
    sharedChannel = channel;
    channel
      .subscribe((status, error) => {
        if (sharedChannel !== channel) return;
        sharedChannelStatus = status;
        if (status === "SUBSCRIBED") {
          // Always reconcile once after joining: an event may have happened
          // while the phone was asleep or while the socket was reconnecting.
          scheduleSharedSave(0);
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          console.error("Canal de synchronisation indisponible.", error);
          // Supabase rejoins automatically with backoff. REST reconciliation
          // keeps the list current while the socket is being repaired.
          sharedChannelStatus = "CONNECTING";
          scheduleSharedSave(0);
          void updateSyncStatus();
          return;
        }
        void updateSyncStatus();
      });
  }

  function ensureRealtimeSubscription() {
    if (!sharedReady || !navigator.onLine) return;
    if (!sharedChannel) subscribeToSharedState();
  }

  async function initializeSharedState() {
    sharedReady = true;
    subscribeToSharedState();
    await synchronizeSharedState();
  }

  function announceChange({ share = true } = {}) {
    if (share) localMutationVersion += 1;
    syncChannel?.postMessage({
      type: "refresh",
      reason: share ? "mutation" : "local",
      at: Date.now(),
    });
    if (share) scheduleSharedSave();
  }

  function normalizeSettings(record) {
    const legacyTarget = record?.quickTarget === "tomorrow"
      ? "cuisineTomorrow"
      : record?.quickTarget === "today"
        ? "cuisineToday"
        : record?.quickTarget;
    return {
      ...DEFAULT_SETTINGS,
      ...(record || {}),
      id: "preferences",
      quickTarget: QUICK_TARGET_ORDER.includes(legacyTarget) ? legacyTarget : "cuisineToday",
      autoMorning: Boolean(record?.autoMorning),
      autoEvening: Boolean(record?.autoEvening),
      _syncRevision: syncRevision(record?._syncRevision),
    };
  }

  function normalizeTask(task) {
    const label = typeof task?.label === "string" ? task.label.trim().slice(0, 180) : "";
    const dueDate = DATE_PATTERN.test(task?.dueDate || "") ? task.dueDate : todayKey();
    const moment = ["morning", "evening", "any"].includes(task?.moment) ? task.moment : "any";
    const section = ["bring", "maintenance"].includes(task?.section) ? task.section : "daily";
    const department = section === "daily" && task?.department === "salle"
      ? "salle"
      : section === "daily"
        ? "cuisine"
        : null;
    return {
      id: typeof task?.id === "string" && task.id ? task.id : makeId("task"),
      label,
      dueDate,
      section,
      department,
      moment: section === "bring" ? "any" : moment,
      completedAt: typeof task?.completedAt === "string" ? task.completedAt : null,
      createdAt: typeof task?.createdAt === "string" ? task.createdAt : new Date().toISOString(),
      updatedAt: typeof task?.updatedAt === "string" ? task.updatedAt : new Date().toISOString(),
      position: Number.isFinite(task?.position) ? task.position : Date.now(),
      manualPosition: Number.isFinite(task?.manualPosition) ? task.manualPosition : null,
      templateId: typeof task?.templateId === "string" ? task.templateId : null,
      occurrenceKey: typeof task?.occurrenceKey === "string" ? task.occurrenceKey : null,
      estimateMinutes: section === "bring" ? null : normalizeEstimateMinutes(task?.estimateMinutes),
      _syncRevision: syncRevision(task?._syncRevision),
    };
  }

  function compactStableId(value) {
    const seeds = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      for (let seedIndex = 0; seedIndex < seeds.length; seedIndex += 1) {
        seeds[seedIndex] = Math.imul(seeds[seedIndex] ^ (code + seedIndex * 131), 0x01000193);
      }
    }
    return seeds
      .map((seed, index) => {
        const mixed = Math.imul(seed ^ (seed >>> 16), 0x85ebca6b + index * 2);
        return (mixed >>> 0).toString(16).padStart(8, "0");
      })
      .join("");
  }

  function historySnapshotId(snapshot) {
    // V2 keeps the entity key compact; the complete immutable snapshot now
    // lives in the payload. decodeHistoryRecord still supports every v1 key.
    return `history-v2:${compactStableId(JSON.stringify([
      snapshot.taskId,
      snapshot.completedAt,
    ]))}`;
  }

  function decodeHistoryRecord(record) {
    const id = typeof record?.id === "string" ? record.id : "";
    let encodedSnapshot = "";
    let reopenedAt = null;
    if (id.startsWith("history-reopened:")) {
      const encodedRecord = id.slice("history-reopened:".length);
      const separatorIndex = encodedRecord.lastIndexOf(":");
      if (separatorIndex < 0) return null;
      encodedSnapshot = encodedRecord.slice(0, separatorIndex);
      try {
        reopenedAt = decodeURIComponent(encodedRecord.slice(separatorIndex + 1));
      } catch {
        return null;
      }
    } else if (id.startsWith("history:")) {
      encodedSnapshot = id.slice("history:".length);
    } else {
      return null;
    }

    try {
      const snapshot = JSON.parse(decodeURIComponent(encodedSnapshot));
      if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
      return {
        ...snapshot,
        id: `history:${encodedSnapshot}`,
        reopenedAt,
        updatedAt: reopenedAt || snapshot.completedAt,
      };
    } catch {
      return null;
    }
  }

  function historyCompatibilityRecord(entry) {
    return {
      id: entry.id,
      recordType: "completion-history",
      taskId: entry.taskId,
      label: entry.label,
      section: entry.section,
      department: entry.department,
      moment: entry.moment,
      dueDate: entry.dueDate,
      completedAt: entry.completedAt,
      reopenedAt: entry.reopenedAt,
      updatedAt: entry.updatedAt,
      dismissedAt: entry.updatedAt,
      _syncRevision: syncRevision(entry?._syncRevision),
    };
  }

  function completionHistoryEntry(task) {
    if (!task?.completedAt) return null;
    return normalizeHistoryEntry({
      taskId: task.id,
      label: task.label,
      section: task.section,
      department: task.department,
      moment: task.moment,
      dueDate: task.dueDate,
      completedAt: task.completedAt,
      reopenedAt: null,
      updatedAt: task.completedAt,
    });
  }

  function reopenedHistoryEntry(task, reopenedAt) {
    if (!task?.completedAt) return null;
    const existingEntry = state.history.find(
      (entry) => entry.taskId === task.id && entry.completedAt === task.completedAt,
    );
    return normalizeHistoryEntry({
      ...(existingEntry || completionHistoryEntry(task)),
      reopenedAt,
      updatedAt: reopenedAt,
    });
  }

  function isHistoryRecord(record) {
    return record?.recordType === "completion-history" ||
      (typeof record?.id === "string" &&
        (record.id.startsWith("history:") || record.id.startsWith("history-reopened:")));
  }

  function normalizeHistoryEntry(entry) {
    const decodedRecord = decodeHistoryRecord(entry);
    const source = decodedRecord ? { ...decodedRecord, ...entry } : entry;
    const completedAt = typeof source?.completedAt === "string" ? source.completedAt : "";
    if (!Number.isFinite(Date.parse(completedAt))) return null;
    const taskId = typeof source?.taskId === "string" && source.taskId
      ? source.taskId
      : "ancienne-tache";
    const label = typeof source?.label === "string" ? source.label.trim().slice(0, 180) : "";
    if (!label) return null;
    const section = ["bring", "maintenance"].includes(source?.section)
      ? source.section
      : "daily";
    const moment = ["morning", "evening", "any"].includes(source?.moment)
      ? source.moment
      : "any";
    const department = section === "daily" && source?.department === "salle"
      ? "salle"
      : section === "daily"
        ? "cuisine"
        : null;
    const reopenedAt = typeof source?.reopenedAt === "string" && Number.isFinite(Date.parse(source.reopenedAt))
      ? source.reopenedAt
      : null;
    const updatedAt = typeof source?.updatedAt === "string" && Number.isFinite(Date.parse(source.updatedAt))
      ? source.updatedAt
      : reopenedAt || completedAt;
    const normalized = {
      recordType: "completion-history",
      taskId,
      label,
      section,
      department,
      moment: section === "daily" ? moment : "any",
      dueDate: DATE_PATTERN.test(source?.dueDate || "")
        ? source.dueDate
        : toDateKey(new Date(completedAt)),
      completedAt,
      reopenedAt,
      updatedAt,
    };
    const id = historySnapshotId(normalized);
    const sameStorageEntity = typeof source?.id !== "string" || source.id === id;
    return {
      ...normalized,
      id,
      _syncRevision: sameStorageEntity ? syncRevision(source?._syncRevision) : 0,
    };
  }

  function historyIdentityKey(entry) {
    return JSON.stringify([entry.taskId, entry.completedAt]);
  }

  function mergeCompletionHistory(...collections) {
    const merged = new Map();
    for (const collection of collections) {
      for (const rawEntry of collection || []) {
        const entry = normalizeHistoryEntry(rawEntry);
        if (!entry) continue;
        const identityKey = historyIdentityKey(entry);
        const previous = merged.get(identityKey);
        const entryReopened = Boolean(entry.reopenedAt);
        const previousReopened = Boolean(previous?.reopenedAt);
        if (
          !previous ||
          (entryReopened && !previousReopened) ||
          (entryReopened === previousReopened && Date.parse(entry.updatedAt) >= Date.parse(previous.updatedAt))
        ) {
          merged.set(identityKey, entry);
        }
      }
    }
    return [...merged.values()].sort((a, b) => {
      const timeDifference = Date.parse(a.completedAt) - Date.parse(b.completedAt);
      return timeDifference || a.id.localeCompare(b.id);
    });
  }

  function normalizeEstimateMinutes(value) {
    const minutes = Number(value);
    return Number.isInteger(minutes) && minutes >= 1 && minutes <= 720 ? minutes : null;
  }

  function formatEstimate(minutes) {
    const normalized = normalizeEstimateMinutes(minutes);
    if (!normalized) return "Aucune";
    if (normalized < 60) return `${normalized} min`;
    const hours = Math.floor(normalized / 60);
    const remainder = normalized % 60;
    return remainder ? `${hours} h ${remainder}` : `${hours} h`;
  }

  function normalizeTemplate(template) {
    const label = typeof template?.label === "string" ? template.label.trim().slice(0, 180) : "";
    const routine = template?.routine === "evening" ? "evening" : "morning";
    return {
      id: typeof template?.id === "string" && template.id ? template.id : makeId("template"),
      label,
      routine,
      department: template?.department === "salle" ? "salle" : "cuisine",
      position: Number.isFinite(template?.position) ? template.position : Date.now(),
      createdAt: typeof template?.createdAt === "string" ? template.createdAt : new Date().toISOString(),
      updatedAt: typeof template?.updatedAt === "string"
        ? template.updatedAt
        : typeof template?.createdAt === "string"
          ? template.createdAt
          : new Date().toISOString(),
      _syncRevision: syncRevision(template?._syncRevision),
    };
  }

  function normalizeOccurrence(occurrence) {
    if (isHistoryRecord(occurrence)) return null;
    if (typeof occurrence?.id !== "string" || !occurrence.id) return null;
    return {
      id: occurrence.id,
      dismissedAt:
        typeof occurrence.dismissedAt === "string" ? occurrence.dismissedAt : new Date().toISOString(),
      _syncRevision: syncRevision(occurrence?._syncRevision),
    };
  }

  function mergeById(primary, secondary, normalize) {
    const merged = new Map();
    for (const raw of [...primary, ...secondary]) {
      const item = normalize(raw);
      if (!item?.id) continue;
      const previous = merged.get(item.id);
      if (!previous) {
        merged.set(item.id, item);
        continue;
      }
      const previousTime = Date.parse(previous.updatedAt || previous.dismissedAt || previous.createdAt || 0);
      const nextTime = Date.parse(item.updatedAt || item.dismissedAt || item.createdAt || 0);
      if (nextTime >= previousTime) merged.set(item.id, item);
    }
    return [...merged.values()];
  }

  async function migrateFallbackIfNeeded() {
    const database = await getDatabase();
    if (!database) return;
    const fallback = readFallback();
    const hasFallback = ["tasks", "history", "templates", "settings", "occurrences", "outbox", "meta"].some(
      (key) => fallback[key].length,
    );
    if (!hasFallback) return;

    const [tasks, templates, settings, occurrenceRecords, currentOutbox, currentMeta] = await Promise.all([
      getAllRecords("tasks"),
      getAllRecords("templates"),
      getAllRecords("settings"),
      getAllRecords("occurrences"),
      getAllRecords("outbox"),
      getAllRecords("meta"),
    ]);
    rememberRevisionMeta([...currentMeta, ...fallback.meta]);
    rememberOutboxRevisions([...currentOutbox, ...fallback.outbox]);
    const settingsCandidates = [...settings, ...fallback.settings]
      .map(normalizeSettings)
      .sort(
        (a, b) =>
          (Date.parse(a.updatedAt || "") || 0) - (Date.parse(b.updatedAt || "") || 0),
      );
    const merged = {
      tasks: mergeById(tasks, fallback.tasks, normalizeTask).filter((task) => task.label),
      history: mergeCompletionHistory(
        occurrenceRecords.filter(isHistoryRecord),
        fallback.history,
        fallback.occurrences.filter(isHistoryRecord),
      ),
      templates: mergeById(templates, fallback.templates, normalizeTemplate).filter(
        (template) => template.label,
      ),
      occurrences: mergeById(
        occurrenceRecords.filter((record) => !isHistoryRecord(record)),
        fallback.occurrences,
        normalizeOccurrence,
      ).filter(Boolean),
      settings: settingsCandidates.at(-1) || { ...DEFAULT_SETTINGS },
    };
    await replaceAllData(merged);
    const pendingKeys = new Set(
      [...currentOutbox, ...fallback.outbox].map(
        (mutation) => mutationEntityKey(mutation.entityType, mutation.entityId),
      ),
    );
    const currentByStore = {
      tasks: new Map(tasks.map((record) => [record.id, record])),
      templates: new Map(templates.map((record) => [record.id, record])),
      occurrences: new Map(occurrenceRecords.map((record) => [record.id, record])),
      settings: new Map(settings.map((record) => [record.id, record])),
    };
    const fallbackRecords = {
      tasks: fallback.tasks.map(normalizeTask).filter((record) => record.label),
      templates: fallback.templates.map(normalizeTemplate).filter((record) => record.label),
      occurrences: [
        ...fallback.occurrences,
        ...fallback.history.map(normalizeHistoryEntry).filter(Boolean).map(historyCompatibilityRecord),
      ],
      settings: fallback.settings.map(normalizeSettings),
    };
    const recoveryMutations = [];
    for (const storeName of ["tasks", "templates", "occurrences", "settings"]) {
      for (const candidate of fallbackRecords[storeName]) {
        const entityType = entityTypeForStore(storeName);
        const entityKey = mutationEntityKey(entityType, candidate.id);
        if (pendingKeys.has(entityKey)) continue;
        const current = currentByStore[storeName].get(candidate.id);
        if (current && recordsShareSamePayload(storeName, candidate, current)) continue;
        const knownRevision = Math.max(
          syncRevision(current?._syncRevision),
          syncRevision(optimisticRevisions.get(entityKey)),
        );
        const mutation = makeMutation(storeName, candidate, "upsert", {
          baseRevision: knownRevision ? knownRevision - 1 : 0,
        });
        recoveryMutations.push(mutation);
        pendingKeys.add(entityKey);
      }
    }
    try {
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(["outbox", "meta"], "readwrite");
        for (const mutation of [...fallback.outbox, ...recoveryMutations]) {
          transaction.objectStore("outbox").put(outboxMutation(mutation));
        }
        for (const metaRecord of fallback.meta) {
          transaction.objectStore("meta").put(metaRecord);
        }
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(
          transaction.error || new Error("Migration de secours annulée"),
        );
      });
    } catch (error) {
      rollbackMutations(recoveryMutations);
      throw error;
    }
    try {
      localStorage.removeItem(FALLBACK_KEY);
    } catch {
      // La fusion est idempotente : conserver la copie de secours reste sans danger.
    }
  }

  async function loadState({ runAutomatic = true } = {}) {
    try {
      const fallbackHistory = readFallback().history;
      const [tasks, templates, settings, occurrenceRecords, outbox, metaRecords] = await Promise.all([
        getAllRecords("tasks"),
        getAllRecords("templates"),
        getAllRecords("settings"),
        getAllRecords("occurrences"),
        getAllRecords("outbox"),
        getAllRecords("meta"),
      ]);

      rememberRevisionMeta(metaRecords);
      rememberOutboxRevisions(outbox);

      state.tasks = tasks.map(normalizeTask).filter((task) => task.label);
      state.history = mergeCompletionHistory(
        occurrenceRecords.filter(isHistoryRecord),
        fallbackHistory,
      );
      state.templates = templates.map(normalizeTemplate).filter((template) => template.label);
      state.occurrences = occurrenceRecords
        .filter((record) => !isHistoryRecord(record))
        .map(normalizeOccurrence)
        .filter(Boolean);
      state.settings = normalizeSettings(settings.find((item) => item.id === "preferences"));
      state.lastDateKey = todayKey();

      const knownHistoryKeys = new Set(state.history.map(historyIdentityKey));
      const backfilledHistory = state.tasks
        .map(completionHistoryEntry)
        .filter((entry) => entry && !knownHistoryKeys.has(historyIdentityKey(entry)));
      if (durableStorageAvailable && backfilledHistory.length) {
        await Promise.all(backfilledHistory.map(putHistoryRecord));
        state.history = mergeCompletionHistory(state.history, backfilledHistory);
        announceChange();
      }

      if (runAutomatic) await runAutomaticRoutines();
      renderAll();
    } catch (error) {
      console.error("Impossible de charger les checklists.", error);
      showToast("Impossible de charger les tâches");
    }
  }

  function tasksForToday(department = "cuisine") {
    const today = todayKey();
    return state.tasks.filter(
      (task) =>
        task.section === "daily" &&
        task.department === department &&
        (task.dueDate === today || (task.dueDate < today && !task.completedAt)),
    );
  }

  function tasksForTomorrow(department = "cuisine") {
    const tomorrow = tomorrowKey();
    return state.tasks.filter(
      (task) =>
        task.section === "daily" &&
        task.department === department &&
        task.dueDate === tomorrow,
    );
  }

  function tasksForBring() {
    return state.tasks.filter((task) => task.section === "bring");
  }

  function tasksForMaintenance() {
    return state.tasks.filter((task) => task.section === "maintenance");
  }

  function taskListForTask(task) {
    if (task?.section === "bring") return "bring";
    if (task?.section === "maintenance") return "maintenance";
    const department = task?.department === "salle" ? "salle" : "cuisine";
    return `${department}${task?.dueDate === tomorrowKey() ? "Tomorrow" : "Today"}`;
  }

  function tasksForListKey(listKey) {
    if (listKey === "cuisineTodayList") return tasksForToday("cuisine");
    if (listKey === "cuisineTomorrowList") return tasksForTomorrow("cuisine");
    if (listKey === "salleTodayList") return tasksForToday("salle");
    if (listKey === "salleTomorrowList") return tasksForTomorrow("salle");
    if (listKey === "bringList") return tasksForBring();
    if (listKey === "maintenanceList") return tasksForMaintenance();
    return [];
  }

  function sortTasks(tasks) {
    const momentRank = { morning: 0, any: 1, evening: 2 };
    return [...tasks].sort((a, b) => {
      const aHasManualPosition = Number.isFinite(a.manualPosition);
      const bHasManualPosition = Number.isFinite(b.manualPosition);
      if (aHasManualPosition || bHasManualPosition) {
        if (aHasManualPosition !== bHasManualPosition) return aHasManualPosition ? -1 : 1;
        const manualDifference = a.manualPosition - b.manualPosition;
        if (manualDifference) return manualDifference;
      }
      const completeDifference = Number(Boolean(a.completedAt)) - Number(Boolean(b.completedAt));
      if (completeDifference) return completeDifference;
      const aIsOverdue = a.section === "daily" && a.dueDate < todayKey() && !a.completedAt;
      const bIsOverdue = b.section === "daily" && b.dueDate < todayKey() && !b.completedAt;
      const overdueDifference = Number(bIsOverdue) - Number(aIsOverdue);
      if (overdueDifference) return overdueDifference;
      const momentDifference = momentRank[a.moment] - momentRank[b.moment];
      if (momentDifference) return momentDifference;
      const positionDifference = a.position - b.position;
      if (positionDifference) return positionDifference;
      const creationDifference = Date.parse(a.createdAt) - Date.parse(b.createdAt);
      if (creationDifference) return creationDifference;
      return a.id.localeCompare(b.id, "fr");
    });
  }

  function sortBringTasks(tasks) {
    return [...tasks].sort((a, b) => {
      const aHasManualPosition = Number.isFinite(a.manualPosition);
      const bHasManualPosition = Number.isFinite(b.manualPosition);
      if (aHasManualPosition || bHasManualPosition) {
        if (aHasManualPosition !== bHasManualPosition) return aHasManualPosition ? -1 : 1;
        const manualDifference = a.manualPosition - b.manualPosition;
        if (manualDifference) return manualDifference;
      }
      const positionDifference = a.position - b.position;
      if (positionDifference) return positionDifference;
      return Date.parse(a.createdAt) - Date.parse(b.createdAt);
    });
  }

  function taskRows(container) {
    return [...container.children].filter((child) => child.classList.contains("task-row"));
  }

  function taskOrder(container) {
    return taskRows(container).map((row) => row.dataset.taskId).filter(Boolean);
  }

  function sameTaskOrder(first, second) {
    return first.length === second.length && first.every((id, index) => id === second[index]);
  }

  function suppressTaskClick(event) {
    if (event.currentTarget.dataset.taskId !== suppressedTaskClickId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.clearTimeout(suppressedTaskClickTimer);
    suppressedTaskClickId = null;
    suppressedTaskClickTimer = null;
  }

  function suppressNextTaskClick(taskId) {
    window.clearTimeout(suppressedTaskClickTimer);
    suppressedTaskClickId = taskId;
    suppressedTaskClickTimer = window.setTimeout(() => {
      suppressedTaskClickId = null;
      suppressedTaskClickTimer = null;
    }, 180);
  }

  function startTaskReorderPress({ inputType, pointerId, row, container, clientX, clientY }) {
    if (reorderGesture) cancelTaskReorder();
    const gesture = {
      inputType,
      pointerId,
      row,
      container,
      startClientX: clientX,
      startClientY: clientY,
      lastClientX: clientX,
      lastClientY: clientY,
      originalOrder: taskOrder(container),
      active: false,
      placeholder: null,
      offsetY: 0,
      timer: null,
    };
    gesture.timer = window.setTimeout(() => activateTaskReorder(gesture), REORDER_HOLD_DELAY);
    reorderGesture = gesture;
    if (inputType === "touch") attachTaskTouchListeners();
  }

  function attachTaskTouchListeners() {
    document.addEventListener("touchstart", handleAdditionalTaskTouch, {
      capture: true,
      passive: true,
    });
    document.addEventListener("touchmove", handleTaskTouchMove, { passive: false });
    document.addEventListener("touchend", handleTaskTouchEnd, { passive: false });
    document.addEventListener("touchcancel", handleTaskTouchCancel, { passive: true });
  }

  function detachTaskTouchListeners() {
    document.removeEventListener("touchstart", handleAdditionalTaskTouch, true);
    document.removeEventListener("touchmove", handleTaskTouchMove);
    document.removeEventListener("touchend", handleTaskTouchEnd);
    document.removeEventListener("touchcancel", handleTaskTouchCancel);
  }

  function activateTaskReorder(gesture) {
    if (reorderGesture !== gesture || !gesture.row.isConnected) return;
    const bounds = gesture.row.getBoundingClientRect();
    if (!bounds.width || !bounds.height) {
      cancelTaskReorder();
      return;
    }

    const placeholder = document.createElement("div");
    placeholder.className = "task-placeholder";
    placeholder.style.height = `${bounds.height}px`;
    placeholder.setAttribute("aria-hidden", "true");
    gesture.row.before(placeholder);

    gesture.active = true;
    gesture.timer = null;
    gesture.placeholder = placeholder;
    gesture.offsetY = Math.min(
      bounds.height,
      Math.max(0, gesture.lastClientY - bounds.top),
    );

    gesture.row.classList.add("is-reordering");
    gesture.row.setAttribute("aria-grabbed", "true");
    gesture.row.style.position = "fixed";
    gesture.row.style.top = `${gesture.lastClientY - gesture.offsetY}px`;
    gesture.row.style.left = `${bounds.left}px`;
    gesture.row.style.width = `${bounds.width}px`;
    gesture.row.style.height = `${bounds.height}px`;
    document.body.classList.add("is-task-reordering");
    try {
      navigator.vibrate?.(18);
    } catch {
      // La vibration est un simple retour facultatif.
    }
  }

  function placeTaskPlaceholder(clientY) {
    const gesture = reorderGesture;
    if (!gesture?.active || !gesture.placeholder?.isConnected) return;
    const rows = taskRows(gesture.container).filter((row) => row !== gesture.row);
    const nextRow = rows.find((row) => {
      const bounds = row.getBoundingClientRect();
      return clientY < bounds.top + bounds.height / 2;
    });
    if (nextRow) gesture.container.insertBefore(gesture.placeholder, nextRow);
    else gesture.container.append(gesture.placeholder);
  }

  function reorderScrollSpeed(clientY) {
    if (clientY < REORDER_EDGE_ZONE) {
      return -Math.ceil(
        ((REORDER_EDGE_ZONE - clientY) / REORDER_EDGE_ZONE) * REORDER_MAX_SCROLL_SPEED,
      );
    }
    const bottomEdge = window.innerHeight - REORDER_EDGE_ZONE;
    if (clientY > bottomEdge) {
      return Math.ceil(
        ((clientY - bottomEdge) / REORDER_EDGE_ZONE) * REORDER_MAX_SCROLL_SPEED,
      );
    }
    return 0;
  }

  function runTaskReorderAutoScroll() {
    reorderAutoScrollFrame = null;
    const gesture = reorderGesture;
    if (!gesture?.active) return;
    const speed = reorderScrollSpeed(gesture.lastClientY);
    if (!speed) return;
    window.scrollBy(0, speed);
    placeTaskPlaceholder(gesture.lastClientY);
    reorderAutoScrollFrame = window.requestAnimationFrame(runTaskReorderAutoScroll);
  }

  function updateTaskReorderAutoScroll() {
    if (!reorderGesture?.active || !reorderScrollSpeed(reorderGesture.lastClientY)) {
      if (reorderAutoScrollFrame) window.cancelAnimationFrame(reorderAutoScrollFrame);
      reorderAutoScrollFrame = null;
      return;
    }
    if (!reorderAutoScrollFrame) {
      reorderAutoScrollFrame = window.requestAnimationFrame(runTaskReorderAutoScroll);
    }
  }

  function moveTaskReorder(clientX, clientY) {
    const gesture = reorderGesture;
    if (!gesture) return;
    gesture.lastClientX = clientX;
    gesture.lastClientY = clientY;

    if (!gesture.active) {
      const distance = Math.hypot(
        clientX - gesture.startClientX,
        clientY - gesture.startClientY,
      );
      if (distance > REORDER_MOVE_TOLERANCE) cancelTaskReorder();
      return;
    }

    gesture.row.style.top = `${clientY - gesture.offsetY}px`;
    placeTaskPlaceholder(clientY);
    updateTaskReorderAutoScroll();
  }

  function clearTaskReorderVisuals(gesture, { commit = false } = {}) {
    window.clearTimeout(gesture.timer);
    if (gesture.inputType === "touch") detachTaskTouchListeners();
    if (reorderAutoScrollFrame) window.cancelAnimationFrame(reorderAutoScrollFrame);
    reorderAutoScrollFrame = null;

    if (gesture.active) {
      if (commit && gesture.placeholder?.parentElement && gesture.row.isConnected) {
        gesture.placeholder.parentElement.insertBefore(gesture.row, gesture.placeholder);
      }
      gesture.placeholder?.remove();
      gesture.row.classList.remove("is-reordering");
      gesture.row.removeAttribute("aria-grabbed");
      for (const property of ["position", "top", "left", "width", "height"]) {
        gesture.row.style.removeProperty(property);
      }
      document.body.classList.remove("is-task-reordering");
    }
  }

  function cancelTaskReorder({ flushSync = true } = {}) {
    const gesture = reorderGesture;
    if (!gesture) return;
    clearTaskReorderVisuals(gesture);
    reorderGesture = null;
    if (flushSync) void flushDeferredTaskSync();
  }

  async function refreshStateBeforeReorderCommit() {
    if (pendingLocalRefresh) {
      pendingLocalRefresh = false;
      await loadState({ runAutomatic: false });
    }
  }

  async function persistTaskOrder({ desiredOrder, listKey, movedTaskId, restoreFocus = true }) {
    try {
      let mergedOrder = [];
      let reorderedById = new Map();

      while (true) {
        await refreshStateBeforeReorderCommit();
        const latestTasks = tasksForListKey(listKey);
        const latestListTasks = listKey === "bringList"
          ? sortBringTasks(latestTasks)
          : sortTasks(latestTasks);
        const latestIds = new Set(latestListTasks.map((task) => task.id));
        if (!latestIds.has(movedTaskId)) {
          renderAll();
          showToast("Cette tâche n’existe plus");
          return;
        }

        mergedOrder = desiredOrder.filter((id) => latestIds.has(id));
        const alreadyOrdered = new Set(mergedOrder);
        for (const task of latestListTasks) {
          if (!alreadyOrdered.has(task.id)) mergedOrder.push(task.id);
        }

        const reorderedTasks = await updateTaskOrderRecords(
          mergedOrder,
          Date.now(),
          new Date().toISOString(),
        );
        reorderedById = new Map(reorderedTasks.map((task) => [task.id, normalizeTask(task)]));
        state.tasks = state.tasks.map((task) => reorderedById.get(task.id) || task);

        if (!pendingLocalRefresh) break;
      }

      announceChange();
      renderAll();
      const movedTask = reorderedById.get(movedTaskId);
      const position = mergedOrder.indexOf(movedTaskId) + 1;
      if (movedTask && position > 0) {
        showToast(`Tâche déplacée en position ${position}`);
      }
      if (restoreFocus) {
        requestAnimationFrame(() => {
          document.querySelector(`[data-task-id="${cssEscape(movedTaskId)}"] .task-main`)?.focus();
        });
      }
    } catch (error) {
      console.error(error);
      renderAll();
      showToast("Nouvel ordre non enregistré");
    }
  }

  async function finishTaskReorder() {
    const gesture = reorderGesture;
    if (!gesture) return;
    if (!gesture.active) {
      cancelTaskReorder();
      return;
    }

    suppressNextTaskClick(gesture.row.dataset.taskId);
    clearTaskReorderVisuals(gesture, { commit: true });
    const desiredOrder = taskOrder(gesture.container);
    const listKey = gesture.container.id;
    const movedTaskId = gesture.row.dataset.taskId;
    if (sameTaskOrder(gesture.originalOrder, desiredOrder)) {
      reorderGesture = null;
      gesture.container.querySelector(`[data-task-id="${cssEscape(movedTaskId)}"] .task-main`)?.focus();
      await flushDeferredTaskSync();
      return;
    }

    reorderPersisting = true;
    reorderGesture = null;
    try {
      await persistTaskOrder({ desiredOrder, listKey, movedTaskId });
    } finally {
      reorderPersisting = false;
      await flushDeferredTaskSync();
    }
  }

  async function moveTaskWithKeyboard(row, direction, { restoreFocus = true } = {}) {
    if (reorderPersisting) return;
    if (reorderGesture) cancelTaskReorder({ flushSync: false });
    const container = row.parentElement;
    const rows = taskRows(container);
    const currentIndex = rows.indexOf(row);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= rows.length) return;
    const target = rows[targetIndex];
    if (direction < 0) container.insertBefore(row, target);
    else container.insertBefore(row, target.nextSibling);
    const desiredOrder = taskOrder(container);
    reorderPersisting = true;
    try {
      await persistTaskOrder({
        desiredOrder,
        listKey: container.id,
        movedTaskId: row.dataset.taskId,
        restoreFocus,
      });
    } finally {
      reorderPersisting = false;
      await flushDeferredTaskSync();
    }
  }

  async function flushDeferredTaskSync() {
    if (taskReorderLocked()) return;
    if (pendingLocalRefresh) {
      pendingLocalRefresh = false;
      await loadState({ runAutomatic: false });
    }
    if (pendingRemoteRefresh) {
      pendingRemoteRefresh = false;
      scheduleSharedSave(20);
    }
  }

  function bindTaskReorder(row, mainButton, container) {
    row.addEventListener("click", suppressTaskClick, true);
    mainButton.setAttribute("aria-keyshortcuts", "Alt+ArrowUp Alt+ArrowDown");

    mainButton.addEventListener(
      "touchstart",
      (event) => {
        if (event.touches.length !== 1) {
          cancelTaskReorder();
          return;
        }
        const touch = event.changedTouches[0];
        lastTouchStartedAt = Date.now();
        startTaskReorderPress({
          inputType: "touch",
          pointerId: touch.identifier,
          row,
          container,
          clientX: touch.clientX,
          clientY: touch.clientY,
        });
      },
      { passive: true },
    );

    mainButton.addEventListener("mousedown", (event) => {
      if (event.button !== 0 || Date.now() - lastTouchStartedAt < 800) return;
      startTaskReorderPress({
        inputType: "mouse",
        pointerId: 0,
        row,
        container,
        clientX: event.clientX,
        clientY: event.clientY,
      });
    });

    mainButton.addEventListener("contextmenu", (event) => {
      if (reorderGesture?.row === row) event.preventDefault();
    });
    mainButton.addEventListener("dragstart", (event) => event.preventDefault());
    mainButton.addEventListener("keydown", (event) => {
      if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      void moveTaskWithKeyboard(row, event.key === "ArrowUp" ? -1 : 1);
    });
  }

  function progressText(tasks) {
    if (!tasks.length) return "";
    const completed = tasks.filter((task) => task.completedAt).length;
    return `${completed}/${tasks.length}`;
  }

  function taskMeta(task) {
    const parts = [];
    if (task.moment === "morning") parts.push("Matin");
    if (task.moment === "evening") parts.push("Soir");
    return parts.join(" · ");
  }

  function renderTaskList(container, tasks, { isBring = false } = {}) {
    const fragment = document.createDocumentFragment();
    const sortedTasks = isBring ? sortBringTasks(tasks) : sortTasks(tasks);
    for (const task of sortedTasks) {
      const row = elements.taskTemplate.content.firstElementChild.cloneNode(true);
      const checkButton = row.querySelector(".check-button");
      const mainButton = row.querySelector(".task-main");
      const moreButton = row.querySelector(".task-more");

      row.dataset.taskId = task.id;
      row.classList.toggle("is-bring-item", isBring);
      row.classList.toggle("is-complete", Boolean(task.completedAt));
      row.querySelector(".task-label").textContent = task.label;
      const meta = isBring ? "" : taskMeta(task);
      row.querySelector(".task-meta").textContent = meta;
      const estimate = row.querySelector(".task-estimate");
      if (!isBring && task.estimateMinutes) {
        estimate.hidden = false;
        row.querySelector(".task-estimate-value").textContent = formatEstimate(task.estimateMinutes);
      }
      row.querySelector(".task-details").hidden = isBring || (!meta && !task.estimateMinutes);
      checkButton.setAttribute(
        "aria-label",
        task.completedAt ? `Réouvrir : ${task.label}` : `Terminer : ${task.label}`,
      );
      bindTaskReorder(row, mainButton, container);
      checkButton.addEventListener("click", () => toggleTask(task.id));
      mainButton.addEventListener("click", () => openTaskEditor(task.id));
      moreButton.addEventListener("click", () => openTaskEditor(task.id));
      fragment.append(row);
    }
    container.replaceChildren(fragment);
  }

  function historyContext(entry) {
    if (entry.section === "bring") return "Courses";
    if (entry.section === "maintenance") return "Entretien / innovation";
    const parts = [entry.department === "salle" ? "Salle" : "Cuisine"];
    if (entry.moment === "morning") parts.push("Matin");
    if (entry.moment === "evening") parts.push("Soir");
    return parts.join(" · ");
  }

  function renderHistory() {
    const entries = state.history.filter((entry) => !entry.reopenedAt).sort((a, b) => {
      const timeDifference = Date.parse(b.completedAt) - Date.parse(a.completedAt);
      return timeDifference || b.id.localeCompare(a.id);
    });
    elements.historySummary.textContent = entries.length
      ? `${entries.length} tâche${entries.length > 1 ? "s" : ""} rayée${entries.length > 1 ? "s" : ""}`
      : "Aucune tâche rayée pour le moment.";

    const fragment = document.createDocumentFragment();
    const groups = new Map();
    for (const entry of entries) {
      const completedDate = new Date(entry.completedAt);
      const key = historyDateKey(completedDate);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    }

    for (const groupedEntries of groups.values()) {
      const group = document.createElement("section");
      group.className = "history-day";

      const heading = document.createElement("h3");
      heading.textContent = historyDayLabel(new Date(groupedEntries[0].completedAt));

      const list = document.createElement("div");
      list.className = "history-day-list";
      list.setAttribute("role", "list");

      for (const entry of groupedEntries) {
        const item = document.createElement("div");
        item.className = "history-item";
        item.setAttribute("role", "listitem");

        const marker = document.createElement("span");
        marker.className = "history-marker";
        marker.setAttribute("aria-hidden", "true");
        marker.textContent = "✓";

        const copy = document.createElement("span");
        copy.className = "history-copy";

        const label = document.createElement("span");
        label.className = "history-label";
        label.textContent = entry.label;

        const meta = document.createElement("span");
        meta.className = "history-meta";
        const context = historyContext(entry);
        meta.textContent = `Rayée à ${historyTimeLabel(new Date(entry.completedAt))}${context ? ` · ${context}` : ""}`;

        copy.append(label, meta);
        item.append(marker, copy);
        list.append(item);
      }

      group.append(heading, list);
      fragment.append(group);
    }

    elements.historyList.replaceChildren(fragment);
  }

  function showSettingsHome({ restoreFocus = false } = {}) {
    elements.settingsTitle.textContent = "Routine";
    elements.backToSettings.hidden = true;
    elements.settingsMainView.hidden = false;
    elements.historyView.hidden = true;
    if (restoreFocus) requestAnimationFrame(() => elements.openHistory.focus());
  }

  function showHistoryView() {
    renderHistory();
    elements.settingsTitle.textContent = "Historique";
    elements.backToSettings.hidden = false;
    elements.settingsMainView.hidden = true;
    elements.historyView.hidden = false;
    elements.settingsContent.scrollTop = 0;
    requestAnimationFrame(() => elements.backToSettings.focus());
  }

  function renderTemplates(routine) {
    const container = routine === "morning" ? elements.morningTemplateList : elements.eveningTemplateList;
    const templates = state.templates
      .filter((template) => template.routine === routine)
      .sort((a, b) => a.position - b.position);
    const fragment = document.createDocumentFragment();

    if (!templates.length) {
      const empty = document.createElement("p");
      empty.className = "template-empty";
      empty.textContent = "Aucune étape";
      fragment.append(empty);
    } else {
      for (const template of templates) {
        const item = document.createElement("div");
        item.className = "template-item";
        item.dataset.templateId = template.id;

        const label = document.createElement("span");
        label.className = "template-item-label";
        label.textContent = template.label;

        const remove = document.createElement("button");
        remove.className = "template-delete";
        remove.type = "button";
        remove.textContent = "×";
        remove.setAttribute("aria-label", `Retirer : ${template.label}`);
        remove.addEventListener("click", () => removeTemplate(template.id));

        item.append(label, remove);
        fragment.append(item);
      }
    }

    container.replaceChildren(fragment);
  }

  function renderAll() {
    const cuisineTodayTasks = tasksForToday("cuisine");
    const cuisineTomorrowTasks = tasksForTomorrow("cuisine");
    const salleTodayTasks = tasksForToday("salle");
    const salleTomorrowTasks = tasksForTomorrow("salle");
    const bringTasks = tasksForBring();
    const maintenanceTasks = tasksForMaintenance();

    elements.currentDate.textContent = new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date());

    renderTaskList(elements.cuisineTodayList, cuisineTodayTasks);
    renderTaskList(elements.cuisineTomorrowList, cuisineTomorrowTasks);
    renderTaskList(elements.salleTodayList, salleTodayTasks);
    renderTaskList(elements.salleTomorrowList, salleTomorrowTasks);
    renderTaskList(elements.bringList, bringTasks, { isBring: true });
    renderTaskList(elements.maintenanceList, maintenanceTasks);
    elements.cuisineTodayProgress.textContent = progressText(cuisineTodayTasks);
    elements.cuisineTomorrowProgress.textContent = progressText(cuisineTomorrowTasks);
    elements.salleTodayProgress.textContent = progressText(salleTodayTasks);
    elements.salleTomorrowProgress.textContent = progressText(salleTomorrowTasks);
    elements.bringProgress.textContent = progressText(bringTasks);
    elements.maintenanceProgress.textContent = progressText(maintenanceTasks);
    elements.emptyAddCuisineToday.hidden = false;
    elements.emptyAddCuisineTomorrow.hidden = false;
    elements.emptyAddSalleToday.hidden = false;
    elements.emptyAddSalleTomorrow.hidden = false;
    elements.emptyAddMaintenance.hidden = false;
    setMaintenanceOpen(state.maintenanceOpen);
    renderTemplates("morning");
    renderTemplates("evening");
    elements.autoMorning.checked = state.settings.autoMorning;
    elements.autoEvening.checked = state.settings.autoEvening;
    renderQuickTarget();
    updateEstimateControls();
    if (!elements.historyView.hidden) renderHistory();
  }

  function renderQuickTarget() {
    const targets = {
      cuisineToday: ["Cuisine · Auj.", "Ajouter à Cuisine aujourd’hui. Appuyer pour changer de liste"],
      cuisineTomorrow: ["Cuisine · Dem.", "Ajouter à Cuisine demain. Appuyer pour changer de liste"],
      salleToday: ["Salle · Auj.", "Ajouter à Salle aujourd’hui. Appuyer pour changer de liste"],
      salleTomorrow: ["Salle · Dem.", "Ajouter à Salle demain. Appuyer pour changer de liste"],
      maintenance: ["Innovation", "Ajouter à Entretien / innovation. Appuyer pour changer de liste"],
      bring: ["Courses", "Ajouter à la liste de courses. Appuyer pour changer de liste"],
    };
    const [label, ariaLabel] = targets[state.settings.quickTarget];
    elements.quickTarget.textContent = label;
    elements.quickTarget.setAttribute("aria-label", ariaLabel);
    elements.quickEstimate.hidden = state.settings.quickTarget === "bring";
  }

  function selectedEstimate() {
    return state.durationTarget === "edit"
      ? state.editEstimateMinutes
      : state.quickEstimateMinutes;
  }

  function updateEstimateControls() {
    const quickLabel = state.quickEstimateMinutes
      ? `Durée estimée : ${formatEstimate(state.quickEstimateMinutes)}`
      : "Ajouter une durée estimée";
    elements.quickEstimate.classList.toggle("is-active", Boolean(state.quickEstimateMinutes));
    elements.quickEstimate.setAttribute("aria-label", quickLabel);
    elements.editEstimateValue.textContent = formatEstimate(state.editEstimateMinutes);

    const selected = selectedEstimate();
    for (const button of elements.durationDialog.querySelectorAll("[data-duration-minutes]")) {
      const active = Number(button.dataset.durationMinutes) === selected;
      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-pressed", String(active));
    }
    elements.clearDuration.classList.toggle("is-selected", !selected);
    elements.clearDuration.setAttribute("aria-pressed", String(!selected));
  }

  function openDurationPicker(target) {
    state.durationTarget = target;
    const currentEstimate = selectedEstimate();
    const hasPreset = Boolean(
      elements.durationDialog.querySelector(`[data-duration-minutes="${currentEstimate}"]`),
    );
    elements.customDurationInput.value = currentEstimate && !hasPreset ? currentEstimate : "";
    updateEstimateControls();
    elements.durationDialog.showModal();
    requestAnimationFrame(() => {
      const preferred = currentEstimate
        ? elements.durationDialog.querySelector(".duration-grid .is-selected") ||
          elements.customDurationInput
        : elements.durationDialog.querySelector('[data-duration-minutes="15"]');
      preferred?.focus();
    });
  }

  function setSelectedEstimate(value) {
    const minutes = normalizeEstimateMinutes(value);
    if (state.durationTarget === "edit") state.editEstimateMinutes = minutes;
    else state.quickEstimateMinutes = minutes;
    updateEstimateControls();
    elements.durationDialog.close();
  }

  function setMaintenanceOpen(isOpen) {
    state.maintenanceOpen = Boolean(isOpen);
    elements.maintenancePanel.hidden = !state.maintenanceOpen;
    elements.maintenanceToggle.setAttribute("aria-expanded", String(state.maintenanceOpen));
  }

  async function updateSettings(patch) {
    const nextSettings = normalizeSettings({
      ...state.settings,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    try {
      const sharedSettingChanged = Object.keys(patch).some((key) => key !== "quickTarget");
      await putRecord("settings", nextSettings, { share: sharedSettingChanged });
      state.settings = nextSettings;
      announceChange({ share: sharedSettingChanged });
      renderQuickTarget();
      elements.autoMorning.checked = state.settings.autoMorning;
      elements.autoEvening.checked = state.settings.autoEvening;
      return true;
    } catch (error) {
      console.error(error);
      showToast("Modification non enregistrée");
      renderAll();
      return false;
    }
  }

  async function addQuickTask(label) {
    const cleanLabel = label.trim().slice(0, 180);
    if (!cleanLabel) return;
    const now = new Date().toISOString();
    const section = ["maintenance", "bring"].includes(state.settings.quickTarget)
      ? state.settings.quickTarget
      : "daily";
    const department = section === "daily" && state.settings.quickTarget.startsWith("salle")
      ? "salle"
      : section === "daily"
        ? "cuisine"
        : null;
    const dueTomorrow = state.settings.quickTarget.endsWith("Tomorrow");
    const task = {
      id: makeId("task"),
      label: cleanLabel,
      dueDate: dueTomorrow ? tomorrowKey() : todayKey(),
      section,
      department,
      moment: "any",
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      position: Date.now(),
      manualPosition: null,
      templateId: null,
      occurrenceKey: null,
      estimateMinutes: section === "bring" ? null : state.quickEstimateMinutes,
    };
    try {
      await putRecord("tasks", task);
      state.tasks.push(task);
      state.quickEstimateMinutes = null;
      announceChange();
      renderAll();
      if (section === "maintenance") setMaintenanceOpen(true);
      return true;
    } catch (error) {
      console.error(error);
      showToast("Tâche non enregistrée");
      return false;
    }
  }

  async function addBringTask(label) {
    const cleanLabel = label.trim().slice(0, 180);
    if (!cleanLabel) return false;
    const now = new Date().toISOString();
    const task = {
      id: makeId("bring"),
      label: cleanLabel,
      dueDate: todayKey(),
      section: "bring",
      department: null,
      moment: "any",
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      position: Date.now(),
      manualPosition: null,
      templateId: null,
      occurrenceKey: null,
      estimateMinutes: null,
    };
    try {
      await putRecord("tasks", task);
      state.tasks.push(task);
      announceChange();
      renderAll();
      return true;
    } catch (error) {
      console.error(error);
      showToast("Élément non enregistré");
      return false;
    }
  }

  async function toggleTask(id) {
    const task = state.tasks.find((item) => item.id === id);
    if (!task) return;
    const changedAt = new Date().toISOString();
    const completedAt = task.completedAt ? null : changedAt;
    const nextTask = {
      ...task,
      completedAt,
      updatedAt: changedAt,
    };
    const historyEntry = completedAt
      ? completionHistoryEntry(nextTask)
      : reopenedHistoryEntry(task, changedAt);
    try {
      await putTaskWithHistory(nextTask, historyEntry);
      state.tasks = state.tasks.map((item) => (item.id === id ? nextTask : item));
      state.history = mergeCompletionHistory(state.history, [historyEntry]);
      announceChange();
      renderAll();
      requestAnimationFrame(() => {
        document.querySelector(`[data-task-id="${cssEscape(id)}"] .check-button`)?.focus();
      });
    } catch (error) {
      console.error(error);
      showToast("Modification non enregistrée");
    }
  }

  function updateEditorDestination() {
    const selectedList = elements.editTaskForm.querySelector('input[name="task-list"]:checked');
    elements.taskListFieldset.hidden = false;
    elements.momentFieldset.hidden = ["bring", "maintenance"].includes(selectedList?.value);
    elements.editEstimate.hidden = selectedList?.value === "bring";
  }

  function openTaskEditor(id) {
    const task = state.tasks.find((item) => item.id === id);
    if (!task) return;
    state.activeTaskId = id;
    elements.taskDialog.querySelector("#taskDialogTitle").textContent =
      task.section === "bring" ? "Modifier — Liste de courses" : "Modifier";
    elements.editTaskLabel.value = task.label;
    const taskList = taskListForTask(task);
    const selectedList = elements.editTaskForm.querySelector(
      `input[name="task-list"][value="${taskList}"]`,
    );
    if (selectedList) selectedList.checked = true;
    const moment = ["morning", "evening"].includes(task.moment) ? task.moment : "any";
    const selectedMoment = elements.editTaskForm.querySelector(`input[name="moment"][value="${moment}"]`);
    if (selectedMoment) selectedMoment.checked = true;
    state.editEstimateMinutes = task.section === "bring" ? null : task.estimateMinutes;
    updateEstimateControls();
    updateEditorDestination();
    elements.taskDialog.showModal();
    requestAnimationFrame(() => elements.editTaskLabel.focus());
  }

  async function saveTaskFromEditor() {
    const task = state.tasks.find((item) => item.id === state.activeTaskId);
    const cleanLabel = elements.editTaskLabel.value.trim().slice(0, 180);
    if (!task || !cleanLabel) return;
    const selectedList = elements.editTaskForm.querySelector('input[name="task-list"]:checked');
    const selectedMoment = elements.editTaskForm.querySelector('input[name="moment"]:checked');
    const taskList = QUICK_TARGET_ORDER.includes(selectedList?.value)
      ? selectedList.value
      : "cuisineToday";
    const isDaily = taskList.startsWith("cuisine") || taskList.startsWith("salle");
    const department = isDaily && taskList.startsWith("salle") ? "salle" : "cuisine";
    const previousTaskList = taskListForTask(task);
    const nextTask = {
      ...task,
      label: cleanLabel,
      dueDate: taskList.endsWith("Tomorrow") ? tomorrowKey() : todayKey(),
      section: isDaily ? "daily" : taskList,
      department: isDaily ? department : null,
      moment: isDaily ? selectedMoment?.value || "any" : "any",
      estimateMinutes: taskList === "bring" ? null : state.editEstimateMinutes,
      manualPosition: previousTaskList === taskList ? task.manualPosition : null,
      updatedAt: new Date().toISOString(),
    };
    try {
      await putRecord("tasks", nextTask);
      state.tasks = state.tasks.map((item) => (item.id === task.id ? nextTask : item));
      announceChange();
      elements.taskDialog.close();
      state.activeTaskId = null;
      renderAll();
      if (taskList === "maintenance") setMaintenanceOpen(true);
      requestAnimationFrame(() => {
        document.querySelector(`[data-task-id="${cssEscape(task.id)}"] .task-main`)?.focus();
      });
    } catch (error) {
      console.error(error);
      showToast("Modification non enregistrée");
    }
  }

  async function deleteActiveTask() {
    const task = state.tasks.find((item) => item.id === state.activeTaskId);
    if (!task) return;
    try {
      const occurrence = await deleteTaskWithOccurrence(task);
      elements.taskDialog.close();
      state.activeTaskId = null;
      state.tasks = state.tasks.filter((item) => item.id !== task.id);
      if (occurrence) {
        state.occurrences = state.occurrences.filter((item) => item.id !== occurrence.id);
        state.occurrences.push(occurrence);
      }
      announceChange();
      renderAll();
      showToast("Tâche supprimée", "Annuler", async () => {
        try {
          await restoreTaskWithOccurrence(task);
          state.tasks.push(task);
          if (task.occurrenceKey) {
            state.occurrences = state.occurrences.filter((item) => item.id !== task.occurrenceKey);
          }
          announceChange();
          renderAll();
          requestAnimationFrame(() => {
            document.querySelector(`[data-task-id="${cssEscape(task.id)}"] .task-main`)?.focus();
          });
        } catch (error) {
          console.error(error);
          showToast("Restauration impossible");
        }
      });
    } catch (error) {
      console.error(error);
      showToast("Suppression non enregistrée");
    }
  }

  async function addTemplate(routine, label) {
    const cleanLabel = label.trim().slice(0, 180);
    if (!cleanLabel) return;
    const createdAt = new Date().toISOString();
    const template = {
      id: makeId("template"),
      label: cleanLabel,
      routine,
      department: "cuisine",
      position: Date.now(),
      createdAt,
      updatedAt: createdAt,
    };
    try {
      await putRecord("templates", template);
      state.templates.push(template);
      announceChange();
      renderTemplates(routine);
      const automatic = routine === "morning" ? state.settings.autoMorning : state.settings.autoEvening;
      if (automatic) await generateRoutine(routine, { silent: true });
      return true;
    } catch (error) {
      console.error(error);
      showToast("Étape non enregistrée");
      return false;
    }
  }

  async function removeTemplate(id) {
    const template = state.templates.find((item) => item.id === id);
    if (!template) return;
    try {
      await deleteRecord("templates", id, template);
      state.templates = state.templates.filter((item) => item.id !== id);
      announceChange();
      renderTemplates(template.routine);
      if (elements.settingsDialog.open) elements.settingsDialog.close();
      showToast("Étape retirée", "Annuler", async () => {
        try {
          await putRecord("templates", template);
          state.templates.push(template);
          announceChange();
          renderTemplates(template.routine);
          elements.settingsDialog.showModal();
          requestAnimationFrame(() => {
            document.querySelector(`[data-template-id="${cssEscape(template.id)}"] .template-delete`)?.focus();
          });
        } catch (error) {
          console.error(error);
          showToast("Restauration impossible");
        }
      });
    } catch (error) {
      console.error(error);
      showToast("Suppression non enregistrée");
    }
  }

  async function generateRoutine(routine, { silent = false } = {}) {
    const templates = state.templates
      .filter((template) => template.routine === routine)
      .sort((a, b) => a.position - b.position);

    if (!templates.length) {
      if (!silent) {
        openSettingsForRoutine(routine);
        showToast(`Ajoute les étapes du ${routine === "morning" ? "matin" : "soir"}`);
      }
      return 0;
    }

    const date = todayKey();
    const existingKeys = new Set(state.tasks.map((task) => task.occurrenceKey).filter(Boolean));
    const dismissedKeys = new Set(state.occurrences.map((occurrence) => occurrence.id));
    const firstManualPosition = Math.min(
      0,
      ...tasksForToday("cuisine")
        .map((task) => task.manualPosition)
        .filter((position) => Number.isFinite(position)),
    );
    const morningStartPosition = firstManualPosition - templates.length;
    let created = 0;
    let needsRefresh = false;

    for (const [index, template] of templates.entries()) {
      const occurrenceKey = `${template.id}:${date}`;
      if (existingKeys.has(occurrenceKey) || (silent && dismissedKeys.has(occurrenceKey))) continue;
      const timestamp = new Date(Date.now() + index).toISOString();
      const task = {
        id: `routine-${template.id}-${date}`,
        label: template.label,
        dueDate: date,
        section: "daily",
        department: template.department === "salle" ? "salle" : "cuisine",
        moment: routine,
        completedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        position: Date.now() + index,
        manualPosition: routine === "morning" ? morningStartPosition + index : null,
        templateId: template.id,
        occurrenceKey,
        estimateMinutes: null,
      };
      try {
        const wasCreated = await createRoutineTaskIfAllowed(task, {
          restoreDismissed: !silent,
        });
        if (wasCreated) {
          state.tasks.push(task);
          state.occurrences = state.occurrences.filter(
            (occurrence) => occurrence.id !== occurrenceKey,
          );
          existingKeys.add(occurrenceKey);
          created += 1;
        } else {
          needsRefresh = true;
        }
      } catch (error) {
        console.error(error);
        if (!silent) showToast("Checklist non enregistrée");
        return created;
      }
    }

    if (created) announceChange();
    if (needsRefresh) await loadState({ runAutomatic: false });
    else renderAll();
    if (!silent) {
      showToast(created ? `${created} tâche${created > 1 ? "s" : ""} ajoutée${created > 1 ? "s" : ""}` : "Checklist déjà prête");
      elements.settingsDialog.open && elements.settingsDialog.close();
      document.querySelector("#cuisineTodayTitle")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    return created;
  }

  async function runAutomaticRoutines() {
    if (state.settings.autoMorning) await generateRoutine("morning", { silent: true });
    if (state.settings.autoEvening) await generateRoutine("evening", { silent: true });
  }

  function openSettingsForRoutine(routine) {
    if (!elements.settingsDialog.open) {
      showSettingsHome();
      elements.settingsDialog.showModal();
    } else if (!elements.historyView.hidden) {
      showSettingsHome();
    }
    requestAnimationFrame(() => {
      const form = document.querySelector(`[data-template-form="${routine}"]`);
      form?.scrollIntoView({ behavior: "smooth", block: "center" });
      form?.querySelector("input")?.focus();
    });
  }

  function showToast(message, actionLabel = "", action = null) {
    window.clearTimeout(toastTimer);
    const supportsPopover = typeof elements.toast.showPopover === "function";
    const openDialog = elements.taskDialog.open
      ? elements.taskDialog
      : elements.settingsDialog.open
        ? elements.settingsDialog
        : null;
    (openDialog || document.body).append(elements.toast);
    elements.toastMessage.textContent = message;
    elements.toastAction.hidden = !actionLabel;
    elements.toastDismiss.hidden = !actionLabel;
    elements.toastAction.textContent = actionLabel;
    elements.toastAction.onclick = action
      ? async () => {
          hideToast();
          await action();
        }
      : null;
    elements.toast.classList.add("is-visible");
    if (supportsPopover && !elements.toast.matches(":popover-open")) elements.toast.showPopover();
    if (action) requestAnimationFrame(() => elements.toastAction.focus());
    else toastTimer = window.setTimeout(hideToast, 2800);
  }

  function hideToast() {
    elements.toast.classList.remove("is-visible");
    if (typeof elements.toast.hidePopover === "function" && elements.toast.matches(":popover-open")) {
      elements.toast.hidePopover();
    }
    if (elements.toast.parentElement !== document.body) document.body.append(elements.toast);
  }

  function exportData() {
    const payload = {
      version: 4,
      exportedAt: new Date().toISOString(),
      tasks: state.tasks,
      history: state.history,
      templates: state.templates,
      settings: state.settings,
      occurrences: state.occurrences,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `auguste-checklist-${todayKey()}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Sauvegarde téléchargée");
  }

  async function importData(file) {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (![1, 2, 3, 4].includes(payload?.version) || !Array.isArray(payload.tasks) || !Array.isArray(payload.templates)) {
        throw new Error("Format non reconnu");
      }

      const occurrenceRecords = Array.isArray(payload.occurrences)
        ? payload.occurrences
        : [];
      const importedHistory = mergeCompletionHistory(
        Array.isArray(payload.history) ? payload.history : [],
        occurrenceRecords.filter(isHistoryRecord),
      );
      const nextState = {
        tasks: payload.tasks.map(normalizeTask).filter((task) => task.label),
        history: payload.version >= 3
          ? importedHistory
          : mergeCompletionHistory(state.history, importedHistory),
        templates: payload.templates.map(normalizeTemplate).filter((template) => template.label),
        occurrences: occurrenceRecords.map(normalizeOccurrence).filter(Boolean),
        settings: normalizeSettings(payload.settings),
      };
      const previousState = {
        tasks: [...state.tasks],
        history: [...state.history],
        templates: [...state.templates],
        occurrences: [...state.occurrences],
        settings: { ...state.settings },
      };
      const confirmed = window.confirm("Remplacer les tâches actuelles par cette sauvegarde ?");
      if (!confirmed) return;
      await replaceAllDataWithMutations(nextState, previousState);
      await loadState({ runAutomatic: false });
      announceChange();
      elements.settingsDialog.close();
      showToast("Sauvegarde restaurée", "Annuler", async () => {
        try {
          await replaceAllDataWithMutations(previousState, nextState);
          await loadState({ runAutomatic: false });
          announceChange();
          requestAnimationFrame(() => elements.quickInput.focus());
        } catch (error) {
          console.error(error);
          showToast("Restauration impossible");
        }
      });
    } catch (error) {
      console.error(error);
      showToast("Fichier de sauvegarde invalide");
    } finally {
      elements.importData.value = "";
    }
  }

  async function clearCompletedTasks() {
    const completed = state.tasks.filter((task) => task.completedAt);
    if (!completed.length) {
      showToast("Aucune tâche terminée");
      return;
    }
    const confirmed = window.confirm(
      `Retirer ${completed.length} tâche${completed.length > 1 ? "s" : ""} terminée${completed.length > 1 ? "s" : ""} ? Elles resteront dans l’historique.`,
    );
    if (!confirmed) return;
    try {
      const tombstones = await deleteCompletedRecords(completed);
      const removedIds = new Set(completed.map((task) => task.id));
      const tombstoneMap = new Map(
        [...state.occurrences, ...tombstones].map((occurrence) => [occurrence.id, occurrence]),
      );
      state.tasks = state.tasks.filter((task) => !removedIds.has(task.id));
      state.occurrences = [...tombstoneMap.values()];
      announceChange();
      renderAll();
      if (elements.settingsDialog.open) elements.settingsDialog.close();
      showToast("Tâches retirées · historique conservé", "Annuler", async () => {
        try {
          await restoreCompletedRecords(completed);
          const currentTaskMap = new Map(state.tasks.map((task) => [task.id, task]));
          for (const task of completed) currentTaskMap.set(task.id, task);
          state.tasks = [...currentTaskMap.values()];
          const restoredOccurrenceIds = new Set(
            completed.map((task) => task.occurrenceKey).filter(Boolean),
          );
          state.occurrences = state.occurrences.filter(
            (occurrence) => !restoredOccurrenceIds.has(occurrence.id),
          );
          announceChange();
          renderAll();
          requestAnimationFrame(() => elements.quickInput.focus());
        } catch (error) {
          console.error(error);
          showToast("Restauration impossible");
        }
      });
    } catch (error) {
      console.error(error);
      showToast("Suppression non enregistrée");
    }
  }

  function closeDialogOnBackdrop(dialog, event) {
    if (event.target === dialog) dialog.close();
  }

  function selectQuickTargetAndFocus(quickTarget) {
    // iOS only opens the keyboard when focus happens synchronously during the tap.
    // Update the in-memory target first so an immediate submission uses the right list.
    state.settings.quickTarget = quickTarget;
    renderQuickTarget();
    elements.quickInput.focus();
    void updateSettings({ quickTarget });
  }

  function gestureTouch(touchList) {
    if (reorderGesture?.inputType !== "touch") return null;
    return Array.from(touchList).find(
      (touch) => touch.identifier === reorderGesture.pointerId,
    ) || null;
  }

  function handleAdditionalTaskTouch(event) {
    if (reorderGesture?.inputType === "touch" && event.touches.length > 1) {
      cancelTaskReorder();
    }
  }

  function handleTaskTouchMove(event) {
    if (reorderGesture?.inputType !== "touch") return;
    if (event.touches.length > 1) {
      cancelTaskReorder();
      return;
    }
    const touch = gestureTouch(event.touches);
    if (!touch) return;
    if (reorderGesture.active) event.preventDefault();
    moveTaskReorder(touch.clientX, touch.clientY);
    if (reorderGesture?.active) event.preventDefault();
  }

  function handleTaskTouchEnd(event) {
    const touch = gestureTouch(event.changedTouches);
    if (!touch) return;
    if (reorderGesture.active) {
      event.preventDefault();
      void finishTaskReorder();
    } else {
      cancelTaskReorder();
    }
  }

  function handleTaskTouchCancel(event) {
    if (gestureTouch(event.changedTouches)) cancelTaskReorder();
  }

  function handleTaskMouseMove(event) {
    if (reorderGesture?.inputType !== "mouse") return;
    if ((event.buttons & 1) === 0) {
      if (reorderGesture.active) void finishTaskReorder();
      else cancelTaskReorder();
      return;
    }
    if (reorderGesture.active) event.preventDefault();
    moveTaskReorder(event.clientX, event.clientY);
  }

  function handleTaskMouseUp(event) {
    if (event.button !== 0 || reorderGesture?.inputType !== "mouse") return;
    if (reorderGesture.active) {
      event.preventDefault();
      void finishTaskReorder();
    } else {
      cancelTaskReorder();
    }
  }

  function bindEvents() {
    window.addEventListener("mousemove", handleTaskMouseMove);
    window.addEventListener("mouseup", handleTaskMouseUp);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && reorderGesture) cancelTaskReorder();
    });
    window.addEventListener("blur", () => cancelTaskReorder());

    elements.quickAddForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const label = elements.quickInput.value;
      if (!label.trim()) return;
      const saved = await addQuickTask(label);
      if (saved) elements.quickInput.value = "";
      elements.quickInput.focus();
    });

    elements.quickTarget.addEventListener("click", () => {
      const currentIndex = QUICK_TARGET_ORDER.indexOf(state.settings.quickTarget);
      const quickTarget = QUICK_TARGET_ORDER[(currentIndex + 1) % QUICK_TARGET_ORDER.length];
      selectQuickTargetAndFocus(quickTarget);
    });

    elements.quickEstimate.addEventListener("click", () => openDurationPicker("quick"));

    elements.bringAddForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const label = elements.bringInput.value;
      if (!label.trim()) return;
      const saved = await addBringTask(label);
      if (saved) elements.bringInput.value = "";
      elements.bringInput.focus();
    });

    elements.maintenanceToggle.addEventListener("click", () => {
      setMaintenanceOpen(!state.maintenanceOpen);
    });

    elements.emptyAddCuisineToday.addEventListener("click", () => {
      selectQuickTargetAndFocus("cuisineToday");
    });

    elements.emptyAddCuisineTomorrow.addEventListener("click", () => {
      selectQuickTargetAndFocus("cuisineTomorrow");
    });

    elements.emptyAddSalleToday.addEventListener("click", () => {
      selectQuickTargetAndFocus("salleToday");
    });

    elements.emptyAddSalleTomorrow.addEventListener("click", () => {
      selectQuickTargetAndFocus("salleTomorrow");
    });

    elements.emptyAddMaintenance.addEventListener("click", () => {
      selectQuickTargetAndFocus("maintenance");
    });

    elements.addMorningToday.addEventListener("click", () => generateRoutine("morning"));
    elements.addEveningToday.addEventListener("click", () => generateRoutine("evening"));

    elements.openSettings.addEventListener("click", () => {
      showSettingsHome();
      elements.settingsDialog.showModal();
      elements.settingsContent.scrollTop = 0;
    });
    elements.openHistory.addEventListener("click", showHistoryView);
    elements.backToSettings.addEventListener("click", () => showSettingsHome({ restoreFocus: true }));
    elements.closeSettings.addEventListener("click", () => elements.settingsDialog.close());
    elements.settingsDialog.addEventListener("click", (event) => closeDialogOnBackdrop(elements.settingsDialog, event));
    elements.settingsDialog.addEventListener("close", () => showSettingsHome());

    for (const form of document.querySelectorAll("[data-template-form]")) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const input = form.querySelector("input");
        const routine = form.dataset.templateForm;
        if (!input.value.trim()) return;
        const label = input.value;
        const saved = await addTemplate(routine, label);
        if (saved) input.value = "";
        input.focus();
      });
    }

    elements.autoMorning.addEventListener("change", async () => {
      const enabled = elements.autoMorning.checked;
      const saved = await updateSettings({ autoMorning: enabled });
      if (saved && enabled) await generateRoutine("morning", { silent: true });
    });

    elements.autoEvening.addEventListener("change", async () => {
      const enabled = elements.autoEvening.checked;
      const saved = await updateSettings({ autoEvening: enabled });
      if (saved && enabled) await generateRoutine("evening", { silent: true });
    });

    elements.editTaskForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await saveTaskFromEditor();
    });
    for (const input of elements.editTaskForm.querySelectorAll('input[name="task-list"]')) {
      input.addEventListener("change", updateEditorDestination);
    }
    elements.editEstimate.addEventListener("click", () => openDurationPicker("edit"));
    elements.closeTaskDialog.addEventListener("click", () => elements.taskDialog.close());
    elements.taskDialog.addEventListener("click", (event) => closeDialogOnBackdrop(elements.taskDialog, event));
    elements.taskDialog.addEventListener("close", () => {
      state.activeTaskId = null;
      state.editEstimateMinutes = null;
    });
    elements.deleteTask.addEventListener("click", deleteActiveTask);

    for (const button of elements.durationDialog.querySelectorAll("[data-duration-minutes]")) {
      button.addEventListener("click", () => setSelectedEstimate(button.dataset.durationMinutes));
    }
    elements.clearDuration.addEventListener("click", () => setSelectedEstimate(null));
    elements.customDurationForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const minutes = normalizeEstimateMinutes(elements.customDurationInput.value);
      if (!minutes) {
        elements.customDurationInput.setCustomValidity("Choisis une durée entre 1 et 720 minutes");
        elements.customDurationInput.reportValidity();
        return;
      }
      elements.customDurationInput.setCustomValidity("");
      setSelectedEstimate(minutes);
    });
    elements.customDurationInput.addEventListener("input", () =>
      elements.customDurationInput.setCustomValidity(""),
    );
    elements.closeDurationDialog.addEventListener("click", () => elements.durationDialog.close());
    elements.durationDialog.addEventListener("click", (event) =>
      closeDialogOnBackdrop(elements.durationDialog, event),
    );
    elements.durationDialog.addEventListener("close", () => {
      const target = state.durationTarget;
      state.durationTarget = null;
      if (target === "edit" && elements.taskDialog.open) elements.editEstimate.focus();
      else if (target === "quick") elements.quickEstimate.focus();
    });

    elements.exportData.addEventListener("click", exportData);
    elements.importDataButton.addEventListener("click", () => elements.importData.click());
    elements.importData.addEventListener("change", () => importData(elements.importData.files?.[0]));
    elements.clearCompleted.addEventListener("click", clearCompletedTasks);
    elements.toastDismiss.addEventListener("click", () => {
      hideToast();
      if (elements.taskDialog.open) elements.closeTaskDialog.focus();
      else if (elements.settingsDialog.open) elements.closeSettings.focus();
      else elements.quickInput.focus();
    });

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      elements.installApp.hidden = false;
    });

    elements.installApp.addEventListener("click", async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        elements.installApp.hidden = true;
        return;
      }
      showToast("Safari → Partager → Sur l’écran d’accueil");
    });

    window.addEventListener("appinstalled", () => {
      elements.installApp.hidden = true;
      showToast("Application installée");
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") {
        cancelTaskReorder();
        if (sharedReady) void synchronizeSharedState();
        return;
      }
      ensureRealtimeSubscription();
      if (state.lastDateKey !== todayKey()) loadState();
      else if (sharedReady) void refreshSharedState();
      else renderAll();
    });

    window.addEventListener("online", () => {
      if (!sharedReady) return;
      ensureRealtimeSubscription();
      void refreshSharedState();
    });
    window.addEventListener("offline", () => {
      sharedChannelStatus = "CONNECTING";
      void updateSyncStatus();
    });
    window.addEventListener("focus", () => {
      if (!sharedReady) return;
      ensureRealtimeSubscription();
      void refreshSharedState();
    });
    window.addEventListener("pageshow", () => {
      if (!sharedReady) return;
      ensureRealtimeSubscription();
      void refreshSharedState();
    });
    window.addEventListener("pagehide", () => {
      if (sharedReady) void synchronizeSharedState();
    });

    syncChannel?.addEventListener("message", (event) => {
      if (event.data?.type !== "refresh") return;
      const carriesMutation = event.data?.reason === "mutation";
      if (carriesMutation) localMutationVersion += 1;
      if (taskReorderLocked()) {
        pendingLocalRefresh = true;
        if (carriesMutation) pendingRemoteRefresh = true;
      }
      else {
        void loadState({ runAutomatic: false }).then(() => {
          // A concurrent tab may have committed an outbox entry immediately
          // before this tab replaced its local projection. Reconcile promptly;
          // the durable outbox remains the source of truth for that mutation.
          if (carriesMutation && sharedReady) scheduleSharedSave(20);
        });
      }
    });
  }

  function prepareInstallControl() {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    if (isIos && !isStandalone) elements.installApp.hidden = false;
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("./sw.js?v=17", {
          updateViaCache: "none",
        });
        await registration.update();
      } catch (error) {
        console.warn("Mode hors ligne indisponible.", error);
      }
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }

  async function refreshSharedState({ skipIfBusy = false } = {}) {
    if (taskReorderLocked()) {
      pendingRemoteRefresh = true;
      return;
    }
    if (skipIfBusy && syncInFlight) return;
    scheduleSharedSave(0);
  }

  async function openApplication() {
    if (appStarted) return;
    appStarted = true;
    durableStorageAvailable = Boolean(await getDatabase());
    if (durableStorageAvailable) await migrateFallbackIfNeeded();
    await loadState({ runAutomatic: false });
    if (!durableStorageAvailable) {
      await updateSyncStatus("storage");
      showToast("Écriture bloquée : stockage sécurisé indisponible");
      renderAll();
      return;
    }
    await initializeSharedState();
    await runAutomaticRoutines();
    renderAll();

    window.setInterval(() => {
      if (state.lastDateKey !== todayKey()) loadState();
      if (sharedReady && document.visibilityState === "visible") {
        ensureRealtimeSubscription();
        void refreshSharedState({ skipIfBusy: true });
      }
    }, FALLBACK_SYNC_INTERVAL_MS);
  }

  async function start() {
    bindEvents();
    prepareInstallControl();
    registerServiceWorker();
    await openApplication();
  }

  start().catch((error) => {
    console.error(error);
    showToast("Impossible de démarrer l’application");
  });
})();
