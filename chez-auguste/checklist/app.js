import { t as createClient } from "../assets/supabase-D_AYc1Jo.js";

(() => {
  "use strict";

  const DB_NAME = "auguste-checklist";
  const DB_VERSION = 2;
  const FALLBACK_KEY = "auguste-checklist-fallback-v1";
  const CHANNEL_NAME = "auguste-checklist-sync";
  const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  const QUICK_TARGET_ORDER = ["today", "tomorrow", "maintenance", "bring"];
  const REORDER_HOLD_DELAY = 450;
  const REORDER_MOVE_TOLERANCE = 9;
  const REORDER_EDGE_ZONE = 96;
  const REORDER_MAX_SCROLL_SPEED = 14;
  const SUPABASE_URL = "https://eoewkjfgqivrkkgpjsrk.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_b9sZUgW7Sr2WItAxEqCoyw_gc-xoJyl";
  const SHARED_SECTION = "checklist";
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
  const DEFAULT_SETTINGS = {
    id: "preferences",
    quickTarget: "today",
    autoMorning: false,
    autoEvening: false,
  };

  const elements = {
    currentDate: document.querySelector("#currentDate"),
    todayList: document.querySelector("#todayList"),
    tomorrowList: document.querySelector("#tomorrowList"),
    bringList: document.querySelector("#bringList"),
    bringAddForm: document.querySelector("#bringAddForm"),
    bringInput: document.querySelector("#bringInput"),
    maintenanceToggle: document.querySelector("#maintenanceToggle"),
    maintenancePanel: document.querySelector("#maintenancePanel"),
    maintenanceList: document.querySelector("#maintenanceList"),
    todayProgress: document.querySelector("#todayProgress"),
    tomorrowProgress: document.querySelector("#tomorrowProgress"),
    bringProgress: document.querySelector("#bringProgress"),
    maintenanceProgress: document.querySelector("#maintenanceProgress"),
    quickAddForm: document.querySelector("#quickAddForm"),
    quickInput: document.querySelector("#quickInput"),
    quickTarget: document.querySelector("#quickTarget"),
    quickEstimate: document.querySelector("#quickEstimate"),
    emptyAddToday: document.querySelector("#emptyAddToday"),
    emptyAddTomorrow: document.querySelector("#emptyAddTomorrow"),
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
  let sharedReady = false;
  let sharedDirty = false;
  let sharedSaving = false;
  let sharedSaveTimer = null;
  let sharedChannel = null;
  let remoteFingerprint = "";
  let pendingRemoteRow = null;
  let lastCommittedAt = 0;
  let syncWarningShown = false;
  let reorderGesture = null;
  let reorderPersisting = false;
  let reorderAutoScrollFrame = null;
  let suppressedTaskClickId = null;
  let suppressedTaskClickTimer = null;
  let lastTouchStartedAt = 0;
  let pendingLocalRefresh = false;
  const syncChannel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  function makeId(prefix) {
    if (crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
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
      };

      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => database.close();
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
      };
    } catch {
      return { tasks: [], history: [], templates: [], settings: [], occurrences: [] };
    }
  }

  function writeFallback(data) {
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

  async function putRecord(storeName, record) {
    const database = await getDatabase();
    if (!database) {
      const data = readFallback();
      const index = data[storeName].findIndex((item) => item.id === record.id);
      if (index >= 0) data[storeName][index] = record;
      else data[storeName].push(record);
      writeFallback(data);
      return;
    }
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Écriture annulée"));
    });
  }

  async function putTaskWithHistory(task, historyEntry = null) {
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
        const compatibilityRecord = historyCompatibilityRecord(historyEntry);
        const occurrenceIndex = data.occurrences.findIndex(
          (item) => item.id === compatibilityRecord.id,
        );
        if (occurrenceIndex >= 0) data.occurrences[occurrenceIndex] = compatibilityRecord;
        else data.occurrences.push(compatibilityRecord);
      }
      writeFallback(data);
      return;
    }
    return new Promise((resolve, reject) => {
      const storeNames = historyEntry ? ["tasks", "occurrences"] : ["tasks"];
      const transaction = database.transaction(storeNames, "readwrite");
      transaction.objectStore("tasks").put(task);
      if (historyEntry) {
        transaction.objectStore("occurrences").put(historyCompatibilityRecord(historyEntry));
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Écriture annulée"));
    });
  }

  async function putHistoryRecord(historyEntry) {
    const database = await getDatabase();
    if (!database) {
      const data = readFallback();
      const index = data.history.findIndex((item) => item.id === historyEntry.id);
      if (index >= 0) data.history[index] = historyEntry;
      else data.history.push(historyEntry);
      const compatibilityRecord = historyCompatibilityRecord(historyEntry);
      const occurrenceIndex = data.occurrences.findIndex(
        (item) => item.id === compatibilityRecord.id,
      );
      if (occurrenceIndex >= 0) data.occurrences[occurrenceIndex] = compatibilityRecord;
      else data.occurrences.push(compatibilityRecord);
      writeFallback(data);
      return;
    }
    return new Promise((resolve, reject) => {
      const transaction = database.transaction("occurrences", "readwrite");
      transaction.objectStore("occurrences").put(historyCompatibilityRecord(historyEntry));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Écriture annulée"));
    });
  }

  async function updateTaskOrderRecords(taskIds, positionBase, updatedAt) {
    if (!taskIds.length) return [];
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
        updatedRecords.push(updatedTask);
        return updatedTask;
      });
      writeFallback(data);
      return updatedRecords;
    }
    return new Promise((resolve, reject) => {
      const transaction = database.transaction("tasks", "readwrite");
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
          updatedRecords.push(updatedTask);
          store.put(updatedTask);
        };
      });
      transaction.oncomplete = () => resolve(updatedRecords);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Écriture annulée"));
    });
  }

  async function deleteRecord(storeName, id) {
    const database = await getDatabase();
    if (!database) {
      const data = readFallback();
      data[storeName] = data[storeName].filter((item) => item.id !== id);
      writeFallback(data);
      return;
    }
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Suppression annulée"));
    });
  }

  async function replaceAllData(nextState) {
    const database = await getDatabase();
    if (!database) {
      const history = nextState.history || [];
      writeFallback({
        tasks: nextState.tasks,
        history,
        templates: nextState.templates,
        settings: [nextState.settings],
        occurrences: [
          ...(nextState.occurrences || []),
          ...history.map(historyCompatibilityRecord),
        ],
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

  async function deleteTaskWithOccurrence(task) {
    const occurrence = task.occurrenceKey
      ? { id: task.occurrenceKey, dismissedAt: new Date().toISOString() }
      : null;
    const database = await getDatabase();
    if (!database) {
      const data = readFallback();
      data.tasks = data.tasks.filter((item) => item.id !== task.id);
      if (occurrence) {
        data.occurrences = data.occurrences.filter((item) => item.id !== occurrence.id);
        data.occurrences.push(occurrence);
      }
      writeFallback(data);
      return occurrence;
    }
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(["tasks", "occurrences"], "readwrite");
      transaction.objectStore("tasks").delete(task.id);
      if (occurrence) transaction.objectStore("occurrences").put(occurrence);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Suppression annulée"));
    });
    return occurrence;
  }

  async function restoreTaskWithOccurrence(task) {
    const database = await getDatabase();
    if (!database) {
      const data = readFallback();
      data.tasks = data.tasks.filter((item) => item.id !== task.id);
      data.tasks.push(task);
      if (task.occurrenceKey) {
        data.occurrences = data.occurrences.filter((item) => item.id !== task.occurrenceKey);
      }
      writeFallback(data);
      return;
    }
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(["tasks", "occurrences"], "readwrite");
      transaction.objectStore("tasks").put(task);
      if (task.occurrenceKey) transaction.objectStore("occurrences").delete(task.occurrenceKey);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Restauration annulée"));
    });
  }

  async function deleteCompletedRecords(tasks) {
    const tombstones = tasks
      .filter((task) => task.occurrenceKey)
      .map((task) => ({ id: task.occurrenceKey, dismissedAt: new Date().toISOString() }));
    const taskIds = new Set(tasks.map((task) => task.id));
    const database = await getDatabase();
    if (!database) {
      const data = readFallback();
      data.tasks = data.tasks.filter((task) => !taskIds.has(task.id));
      const tombstoneIds = new Set(tombstones.map((occurrence) => occurrence.id));
      data.occurrences = data.occurrences.filter((occurrence) => !tombstoneIds.has(occurrence.id));
      data.occurrences.push(...tombstones);
      writeFallback(data);
      return tombstones;
    }
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(["tasks", "occurrences"], "readwrite");
      const taskStore = transaction.objectStore("tasks");
      const occurrenceStore = transaction.objectStore("occurrences");
      for (const task of tasks) taskStore.delete(task.id);
      for (const occurrence of tombstones) occurrenceStore.put(occurrence);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Suppression annulée"));
    });
    return tombstones;
  }

  async function restoreCompletedRecords(tasks) {
    const database = await getDatabase();
    if (!database) {
      const data = readFallback();
      const restoredIds = new Set(tasks.map((task) => task.id));
      const occurrenceIds = new Set(tasks.map((task) => task.occurrenceKey).filter(Boolean));
      data.tasks = data.tasks.filter((task) => !restoredIds.has(task.id));
      data.tasks.push(...tasks);
      data.occurrences = data.occurrences.filter((occurrence) => !occurrenceIds.has(occurrence.id));
      writeFallback(data);
      return;
    }
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(["tasks", "occurrences"], "readwrite");
      const taskStore = transaction.objectStore("tasks");
      const occurrenceStore = transaction.objectStore("occurrences");
      for (const task of tasks) {
        taskStore.put(task);
        if (task.occurrenceKey) occurrenceStore.delete(task.occurrenceKey);
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Restauration annulée"));
    });
  }

  async function createRoutineTaskIfAllowed(task, { restoreDismissed = false } = {}) {
    const database = await getDatabase();
    if (!database) {
      const data = readFallback();
      const dismissed = data.occurrences.some((item) => item.id === task.occurrenceKey);
      const exists = data.tasks.some((item) => item.id === task.id);
      if (exists || (dismissed && !restoreDismissed)) return false;
      if (dismissed) {
        data.occurrences = data.occurrences.filter((item) => item.id !== task.occurrenceKey);
      }
      data.tasks.push(task);
      writeFallback(data);
      return true;
    }
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(["tasks", "occurrences"], "readwrite");
      const taskStore = transaction.objectStore("tasks");
      const occurrenceStore = transaction.objectStore("occurrences");
      let created = false;
      const occurrenceRequest = occurrenceStore.get(task.occurrenceKey);
      occurrenceRequest.onsuccess = () => {
        const dismissed = Boolean(occurrenceRequest.result);
        if (dismissed && !restoreDismissed) return;
        const taskRequest = taskStore.get(task.id);
        taskRequest.onsuccess = () => {
          if (taskRequest.result) return;
          if (dismissed) occurrenceStore.delete(task.occurrenceKey);
          taskStore.put(task);
          created = true;
        };
      };
      transaction.oncomplete = () => resolve(created);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Création annulée"));
    });
  }

  function sharedPayload() {
    return {
      version: 1,
      tasks: state.tasks,
      templates: state.templates,
      // L'historique voyage dans le champ déjà connu des anciennes versions de la PWA.
      occurrences: [
        ...state.occurrences,
        ...state.history.map(historyCompatibilityRecord),
      ],
      settings: {
        autoMorning: state.settings.autoMorning,
        autoEvening: state.settings.autoEvening,
      },
      _client_instance_id: CLIENT_INSTANCE_ID,
    };
  }

  function payloadFingerprint(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
    const occurrenceRecords = Array.isArray(payload.occurrences) ? payload.occurrences : [];
    const history = mergeCompletionHistory(
      Array.isArray(payload.history) ? payload.history : [],
      occurrenceRecords.filter(isHistoryRecord),
    );
    const normalized = {
      version: 1,
      tasks: Array.isArray(payload.tasks) ? payload.tasks : [],
      templates: Array.isArray(payload.templates) ? payload.templates : [],
      occurrences: [
        ...occurrenceRecords.map(normalizeOccurrence).filter(Boolean),
        ...history.map(historyCompatibilityRecord),
      ],
      settings: {
        autoMorning: Boolean(payload.settings?.autoMorning),
        autoEvening: Boolean(payload.settings?.autoEvening),
      },
    };
    return JSON.stringify(normalized);
  }

  function isSharedPayload(payload) {
    return Boolean(
      payload &&
        typeof payload === "object" &&
        !Array.isArray(payload) &&
        Array.isArray(payload.tasks) &&
        Array.isArray(payload.templates),
    );
  }

  function taskReorderLocked() {
    return Boolean(reorderGesture) || reorderPersisting;
  }

  function queuePendingRemoteRow(row) {
    const queuedTime = Date.parse(pendingRemoteRow?.updated_at || "") || 0;
    const nextTime = Date.parse(row?.updated_at || "") || 0;
    if (!pendingRemoteRow || nextTime >= queuedTime) pendingRemoteRow = row;
  }

  async function applySharedRow(row, { force = false } = {}) {
    const payload = row?.payload;
    if (!isSharedPayload(payload)) return;
    if (payload._client_instance_id === CLIENT_INSTANCE_ID) return;
    if (!force && taskReorderLocked()) {
      queuePendingRemoteRow(row);
      return;
    }
    const fingerprint = payloadFingerprint(payload);
    const needsCompatibilityRewrite =
      payload.version !== 1 || Object.prototype.hasOwnProperty.call(payload, "history");
    if (!fingerprint) return;
    if (fingerprint === remoteFingerprint) {
      if (needsCompatibilityRewrite) scheduleSharedSave();
      return;
    }

    const quickTarget = state.settings.quickTarget;
    const remoteOccurrenceRecords = Array.isArray(payload.occurrences)
      ? payload.occurrences
      : [];
    const normalizedRemoteHistory = mergeCompletionHistory(
      Array.isArray(payload.history) ? payload.history : [],
      remoteOccurrenceRecords.filter(isHistoryRecord),
    );
    const history = mergeCompletionHistory(normalizedRemoteHistory, state.history);
    const shouldRepublishHistory =
      needsCompatibilityRewrite ||
      JSON.stringify(history) !== JSON.stringify(normalizedRemoteHistory);
    const nextState = {
      tasks: payload.tasks.map(normalizeTask).filter((task) => task.label),
      history,
      templates: payload.templates.map(normalizeTemplate).filter((template) => template.label),
      occurrences: remoteOccurrenceRecords.map(normalizeOccurrence).filter(Boolean),
      settings: normalizeSettings({
        ...payload.settings,
        quickTarget,
        updatedAt: row.updated_at,
      }),
    };
    await replaceAllData(nextState);
    remoteFingerprint = fingerprint;
    lastCommittedAt = Math.max(lastCommittedAt, Date.parse(row.updated_at) || 0);
    await loadState({ runAutomatic: false });
    if (shouldRepublishHistory) scheduleSharedSave();
    syncChannel?.postMessage({ type: "refresh", at: Date.now() });
  }

  async function saveSharedState() {
    if (!sharedReady || sharedSaving || !sharedDirty) return;
    if (reorderGesture?.active || reorderPersisting) {
      scheduleSharedSave(600);
      return;
    }
    sharedSaving = true;
    sharedDirty = false;
    const payload = sharedPayload();
    try {
      const { data, error } = await supabase
        .from("auguste_shared_state")
        .upsert(
          {
            section: SHARED_SECTION,
            payload,
            updated_at: new Date().toISOString(),
            updated_by: null,
          },
          { onConflict: "section" },
        )
        .select("section,payload,updated_at,updated_by")
        .single();
      if (error) throw error;
      remoteFingerprint = payloadFingerprint(data.payload);
      lastCommittedAt = Date.parse(data.updated_at) || Date.now();
      syncWarningShown = false;
      window.setTimeout(() => {
        if (sharedReady && !sharedDirty && !sharedSaving && navigator.onLine) {
          void refreshSharedState();
        }
      }, 1400);
    } catch (error) {
      console.error("Synchronisation différée.", error);
      sharedDirty = true;
      if (!syncWarningShown) {
        syncWarningShown = true;
        showToast("Synchronisation en attente");
      }
    } finally {
      sharedSaving = false;
    }

    if (pendingRemoteRow && !taskReorderLocked()) {
      const row = pendingRemoteRow;
      pendingRemoteRow = null;
      const remoteTime = Date.parse(row.updated_at) || 0;
      if (remoteTime > lastCommittedAt) await applySharedRow(row);
    }
    if (sharedDirty && navigator.onLine) scheduleSharedSave(10_000);
  }

  function scheduleSharedSave(delay = 260) {
    if (!sharedReady) return;
    sharedDirty = true;
    window.clearTimeout(sharedSaveTimer);
    sharedSaveTimer = window.setTimeout(() => void saveSharedState(), delay);
  }

  async function loadSharedRow() {
    const { data, error } = await supabase
      .from("auguste_shared_state")
      .select("section,payload,updated_at,updated_by")
      .eq("section", SHARED_SECTION)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  function subscribeToSharedState() {
    if (sharedChannel) void supabase.removeChannel(sharedChannel);
    sharedChannel = supabase
      .channel(`chez-auguste:${SHARED_SECTION}:${CLIENT_INSTANCE_ID}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "auguste_shared_state",
          filter: `section=eq.${SHARED_SECTION}`,
        },
        (event) => {
          const row = event.new;
          if (!row?.payload || row.payload._client_instance_id === CLIENT_INSTANCE_ID) return;
          if (sharedSaving || sharedDirty || taskReorderLocked()) queuePendingRemoteRow(row);
          else void applySharedRow(row);
        },
      )
      .subscribe();
  }

  async function initializeSharedState() {
    sharedReady = true;
    subscribeToSharedState();
    try {
      const row = await loadSharedRow();
      if (row && isSharedPayload(row.payload)) {
        await applySharedRow(row);
        remoteFingerprint = payloadFingerprint(row.payload);
        lastCommittedAt = Date.parse(row.updated_at) || 0;
      } else {
        sharedDirty = true;
        await saveSharedState();
      }
    } catch (error) {
      console.error("La liste partagée est momentanément indisponible.", error);
      sharedDirty = true;
      showToast("Mode hors ligne");
    }
  }

  function announceChange({ share = true } = {}) {
    syncChannel?.postMessage({ type: "refresh", at: Date.now() });
    if (share) scheduleSharedSave();
  }

  function normalizeSettings(record) {
    return {
      ...DEFAULT_SETTINGS,
      ...(record || {}),
      id: "preferences",
      quickTarget: QUICK_TARGET_ORDER.includes(record?.quickTarget) ? record.quickTarget : "today",
      autoMorning: Boolean(record?.autoMorning),
      autoEvening: Boolean(record?.autoEvening),
    };
  }

  function normalizeTask(task) {
    const label = typeof task?.label === "string" ? task.label.trim().slice(0, 180) : "";
    const dueDate = DATE_PATTERN.test(task?.dueDate || "") ? task.dueDate : todayKey();
    const moment = ["morning", "evening", "any"].includes(task?.moment) ? task.moment : "any";
    const section = ["bring", "maintenance"].includes(task?.section) ? task.section : "daily";
    return {
      id: typeof task?.id === "string" && task.id ? task.id : makeId("task"),
      label,
      dueDate,
      section,
      moment: section === "bring" ? "any" : moment,
      completedAt: typeof task?.completedAt === "string" ? task.completedAt : null,
      createdAt: typeof task?.createdAt === "string" ? task.createdAt : new Date().toISOString(),
      updatedAt: typeof task?.updatedAt === "string" ? task.updatedAt : new Date().toISOString(),
      position: Number.isFinite(task?.position) ? task.position : Date.now(),
      manualPosition: Number.isFinite(task?.manualPosition) ? task.manualPosition : null,
      templateId: typeof task?.templateId === "string" ? task.templateId : null,
      occurrenceKey: typeof task?.occurrenceKey === "string" ? task.occurrenceKey : null,
      estimateMinutes: section === "bring" ? null : normalizeEstimateMinutes(task?.estimateMinutes),
    };
  }

  function historySnapshotId(snapshot) {
    // Le snapshot dans l’identifiant permet aux anciennes PWA de le relayer sans le comprendre.
    const encodedSnapshot = encodeURIComponent(JSON.stringify({
      version: 1,
      taskId: snapshot.taskId,
      label: snapshot.label,
      section: snapshot.section,
      moment: snapshot.moment,
      dueDate: snapshot.dueDate,
      completedAt: snapshot.completedAt,
    }));
    return `history:${encodedSnapshot}`;
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
    const encodedSnapshot = entry.id.slice("history:".length);
    return {
      id: entry.reopenedAt
        ? `history-reopened:${encodedSnapshot}:${encodeURIComponent(entry.reopenedAt)}`
        : entry.id,
      dismissedAt: entry.updatedAt,
    };
  }

  function completionHistoryEntry(task) {
    if (!task?.completedAt) return null;
    return normalizeHistoryEntry({
      taskId: task.id,
      label: task.label,
      section: task.section,
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
      moment: section === "daily" ? moment : "any",
      dueDate: DATE_PATTERN.test(source?.dueDate || "")
        ? source.dueDate
        : toDateKey(new Date(completedAt)),
      completedAt,
      reopenedAt,
      updatedAt,
    };
    return { ...normalized, id: historySnapshotId(normalized) };
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
      position: Number.isFinite(template?.position) ? template.position : Date.now(),
      createdAt: typeof template?.createdAt === "string" ? template.createdAt : new Date().toISOString(),
    };
  }

  function normalizeOccurrence(occurrence) {
    if (isHistoryRecord(occurrence)) return null;
    if (typeof occurrence?.id !== "string" || !occurrence.id) return null;
    return {
      id: occurrence.id,
      dismissedAt:
        typeof occurrence.dismissedAt === "string" ? occurrence.dismissedAt : new Date().toISOString(),
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
    const hasFallback = ["tasks", "history", "templates", "settings", "occurrences"].some(
      (key) => fallback[key].length,
    );
    if (!hasFallback) return;

    const [tasks, templates, settings, occurrenceRecords] = await Promise.all([
      getAllRecords("tasks"),
      getAllRecords("templates"),
      getAllRecords("settings"),
      getAllRecords("occurrences"),
    ]);
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
    try {
      localStorage.removeItem(FALLBACK_KEY);
    } catch {
      // La fusion est idempotente : conserver la copie de secours reste sans danger.
    }
  }

  async function loadState({ runAutomatic = true } = {}) {
    try {
      const fallbackHistory = readFallback().history;
      const [tasks, templates, settings, occurrenceRecords] = await Promise.all([
        getAllRecords("tasks"),
        getAllRecords("templates"),
        getAllRecords("settings"),
        getAllRecords("occurrences"),
      ]);

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
      if (backfilledHistory.length) {
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

  function tasksForToday() {
    const today = todayKey();
    return state.tasks.filter(
      (task) =>
        task.section === "daily" &&
        (task.dueDate === today || (task.dueDate < today && !task.completedAt)),
    );
  }

  function tasksForTomorrow() {
    const tomorrow = tomorrowKey();
    return state.tasks.filter(
      (task) => task.section === "daily" && task.dueDate === tomorrow,
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
    return task?.dueDate === tomorrowKey() ? "tomorrow" : "today";
  }

  function tasksForListKey(listKey) {
    if (listKey === "todayList") return tasksForToday();
    if (listKey === "tomorrowList") return tasksForTomorrow();
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
    if (pendingRemoteRow && !sharedDirty) {
      const row = pendingRemoteRow;
      pendingRemoteRow = null;
      const remoteTime = Date.parse(row.updated_at) || 0;
      if (remoteTime > lastCommittedAt) await applySharedRow(row, { force: true });
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

        const shouldMergePendingRemote = Boolean(pendingRemoteRow) && !sharedDirty;
        if (!pendingLocalRefresh && !shouldMergePendingRemote) break;
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
          document.querySelector(`[data-task-id="${movedTaskId}"] .task-main`)?.focus();
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
      gesture.container.querySelector(`[data-task-id="${movedTaskId}"] .task-main`)?.focus();
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
    if (pendingRemoteRow && !sharedSaving && !sharedDirty) {
      const row = pendingRemoteRow;
      pendingRemoteRow = null;
      const remoteTime = Date.parse(row.updated_at) || 0;
      if (remoteTime > lastCommittedAt) await applySharedRow(row);
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
    if (task.section === "daily" && task.dueDate < todayKey() && !task.completedAt) {
      parts.push("En retard");
    }
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
      row.classList.toggle(
        "is-overdue",
        task.section === "daily" && task.dueDate < todayKey() && !task.completedAt,
      );
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
    if (entry.section === "maintenance") return "Entretien";
    if (entry.moment === "morning") return "Matin";
    if (entry.moment === "evening") return "Soir";
    return "";
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
    const todayTasks = tasksForToday();
    const tomorrowTasks = tasksForTomorrow();
    const bringTasks = tasksForBring();
    const maintenanceTasks = tasksForMaintenance();

    elements.currentDate.textContent = new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date());

    renderTaskList(elements.todayList, todayTasks);
    renderTaskList(elements.tomorrowList, tomorrowTasks);
    renderTaskList(elements.bringList, bringTasks, { isBring: true });
    renderTaskList(elements.maintenanceList, maintenanceTasks);
    elements.todayProgress.textContent = progressText(todayTasks);
    elements.tomorrowProgress.textContent = progressText(tomorrowTasks);
    elements.bringProgress.textContent = progressText(bringTasks);
    elements.maintenanceProgress.textContent = progressText(maintenanceTasks);
    elements.emptyAddToday.hidden = false;
    elements.emptyAddTomorrow.hidden = false;
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
      today: ["Aujourd’hui", "Ajouter à aujourd’hui. Appuyer pour choisir demain"],
      tomorrow: ["Demain", "Ajouter à demain. Appuyer pour choisir Entretien / Rénovation"],
      maintenance: ["Rénovation", "Ajouter à Entretien / Rénovation. Appuyer pour choisir la liste de courses"],
      bring: ["Courses", "Ajouter à la liste de courses. Appuyer pour choisir aujourd’hui"],
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
      await putRecord("settings", nextSettings);
      state.settings = nextSettings;
      const sharedSettingChanged = Object.keys(patch).some((key) => key !== "quickTarget");
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
    const task = {
      id: makeId("task"),
      label: cleanLabel,
      dueDate: state.settings.quickTarget === "tomorrow" ? tomorrowKey() : todayKey(),
      section,
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
        document.querySelector(`[data-task-id="${id}"] .check-button`)?.focus();
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
      : "today";
    const isDaily = ["today", "tomorrow"].includes(taskList);
    const previousTaskList = taskListForTask(task);
    const nextTask = {
      ...task,
      label: cleanLabel,
      dueDate: taskList === "tomorrow" ? tomorrowKey() : todayKey(),
      section: isDaily ? "daily" : taskList,
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
        document.querySelector(`[data-task-id="${task.id}"] .task-main`)?.focus();
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
            document.querySelector(`[data-task-id="${task.id}"] .task-main`)?.focus();
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
    const template = {
      id: makeId("template"),
      label: cleanLabel,
      routine,
      position: Date.now(),
      createdAt: new Date().toISOString(),
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
      await deleteRecord("templates", id);
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
            document.querySelector(`[data-template-id="${template.id}"] .template-delete`)?.focus();
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
      ...tasksForToday()
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
      document.querySelector("#todayTitle")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      version: 3,
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
      if (![1, 2, 3].includes(payload?.version) || !Array.isArray(payload.tasks) || !Array.isArray(payload.templates)) {
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
        history: payload.version === 3
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
      await replaceAllData(nextState);
      await loadState({ runAutomatic: false });
      announceChange();
      elements.settingsDialog.close();
      showToast("Sauvegarde restaurée", "Annuler", async () => {
        try {
          await replaceAllData(previousState);
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

    elements.emptyAddToday.addEventListener("click", () => {
      selectQuickTargetAndFocus("today");
    });

    elements.emptyAddTomorrow.addEventListener("click", () => {
      selectQuickTargetAndFocus("tomorrow");
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
        return;
      }
      if (state.lastDateKey !== todayKey()) loadState();
      else if (sharedReady) void refreshSharedState();
      else renderAll();
    });

    window.addEventListener("online", () => {
      if (sharedReady) void refreshSharedState();
    });

    syncChannel?.addEventListener("message", (event) => {
      if (event.data?.type !== "refresh") return;
      if (taskReorderLocked()) pendingLocalRefresh = true;
      else loadState({ runAutomatic: false });
    });
  }

  function prepareInstallControl() {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    if (isIos && !isStandalone) elements.installApp.hidden = false;
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("./sw.js").catch((error) => {
        console.warn("Mode hors ligne indisponible.", error);
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }

  async function refreshSharedState() {
    try {
      const row = await loadSharedRow();
      const fingerprint = row ? payloadFingerprint(row.payload) : "";
      if (row && fingerprint && fingerprint !== remoteFingerprint) {
        if (taskReorderLocked()) queuePendingRemoteRow(row);
        else await applySharedRow(row);
      }
      if (sharedDirty && !taskReorderLocked()) await saveSharedState();
    } catch (error) {
      console.error("Actualisation partagée différée.", error);
    }
  }

  async function openApplication() {
    if (appStarted) return;
    appStarted = true;
    await migrateFallbackIfNeeded();
    await loadState({ runAutomatic: false });
    await initializeSharedState();
    await runAutomaticRoutines();
    renderAll();

    window.setInterval(() => {
      if (state.lastDateKey !== todayKey()) loadState();
    }, 60_000);
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
