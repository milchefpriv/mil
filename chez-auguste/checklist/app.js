(() => {
  "use strict";

  const DB_NAME = "auguste-checklist";
  const DB_VERSION = 2;
  const FALLBACK_KEY = "auguste-checklist-fallback-v1";
  const CHANNEL_NAME = "auguste-checklist-sync";
  const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  const QUICK_TARGET_ORDER = ["today", "tomorrow", "maintenance"];
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
    maintenanceList: document.querySelector("#maintenanceList"),
    todayProgress: document.querySelector("#todayProgress"),
    tomorrowProgress: document.querySelector("#tomorrowProgress"),
    maintenanceProgress: document.querySelector("#maintenanceProgress"),
    morningProgress: document.querySelector("#morningProgress"),
    eveningProgress: document.querySelector("#eveningProgress"),
    morningRoutine: document.querySelector("#morningRoutine"),
    eveningRoutine: document.querySelector("#eveningRoutine"),
    quickAddForm: document.querySelector("#quickAddForm"),
    quickInput: document.querySelector("#quickInput"),
    quickTarget: document.querySelector("#quickTarget"),
    emptyAddToday: document.querySelector("#emptyAddToday"),
    emptyAddTomorrow: document.querySelector("#emptyAddTomorrow"),
    emptyAddMaintenance: document.querySelector("#emptyAddMaintenance"),
    taskTemplate: document.querySelector("#taskTemplate"),
    settingsDialog: document.querySelector("#settingsDialog"),
    openSettings: document.querySelector("#openSettings"),
    closeSettings: document.querySelector("#closeSettings"),
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
    momentFieldset: document.querySelector("#momentFieldset"),
    closeTaskDialog: document.querySelector("#closeTaskDialog"),
    deleteTask: document.querySelector("#deleteTask"),
    toast: document.querySelector("#toast"),
    toastMessage: document.querySelector("#toastMessage"),
    toastAction: document.querySelector("#toastAction"),
    toastDismiss: document.querySelector("#toastDismiss"),
  };

  const state = {
    tasks: [],
    templates: [],
    occurrences: [],
    settings: { ...DEFAULT_SETTINGS },
    activeTaskId: null,
    lastDateKey: "",
  };

  let deferredInstallPrompt = null;
  let toastTimer = null;
  let databasePromise = null;
  const syncChannel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;

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
        templates: Array.isArray(parsed.templates) ? parsed.templates : [],
        settings: Array.isArray(parsed.settings) ? parsed.settings : [],
        occurrences: Array.isArray(parsed.occurrences) ? parsed.occurrences : [],
      };
    } catch {
      return { tasks: [], templates: [], settings: [], occurrences: [] };
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
      writeFallback({
        tasks: nextState.tasks,
        templates: nextState.templates,
        settings: [nextState.settings],
        occurrences: nextState.occurrences || [],
      });
      return;
    }

    return new Promise((resolve, reject) => {
      const storeNames = ["tasks", "templates", "settings", "occurrences"];
      const transaction = database.transaction(storeNames, "readwrite");
      for (const storeName of storeNames) transaction.objectStore(storeName).clear();
      for (const task of nextState.tasks) transaction.objectStore("tasks").put(task);
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

  async function createRoutineTaskIfAllowed(task) {
    const database = await getDatabase();
    if (!database) {
      const data = readFallback();
      const dismissed = data.occurrences.some((item) => item.id === task.occurrenceKey);
      const exists = data.tasks.some((item) => item.id === task.id);
      if (dismissed || exists) return false;
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
        if (occurrenceRequest.result) return;
        const taskRequest = taskStore.get(task.id);
        taskRequest.onsuccess = () => {
          if (taskRequest.result) return;
          taskStore.put(task);
          created = true;
        };
      };
      transaction.oncomplete = () => resolve(created);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Création annulée"));
    });
  }

  function announceChange() {
    syncChannel?.postMessage({ type: "refresh", at: Date.now() });
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
    return {
      id: typeof task?.id === "string" && task.id ? task.id : makeId("task"),
      label,
      dueDate,
      section: task?.section === "maintenance" ? "maintenance" : "daily",
      moment,
      completedAt: typeof task?.completedAt === "string" ? task.completedAt : null,
      createdAt: typeof task?.createdAt === "string" ? task.createdAt : new Date().toISOString(),
      updatedAt: typeof task?.updatedAt === "string" ? task.updatedAt : new Date().toISOString(),
      position: Number.isFinite(task?.position) ? task.position : Date.now(),
      templateId: typeof task?.templateId === "string" ? task.templateId : null,
      occurrenceKey: typeof task?.occurrenceKey === "string" ? task.occurrenceKey : null,
    };
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
    const hasFallback = ["tasks", "templates", "settings", "occurrences"].some(
      (key) => fallback[key].length,
    );
    if (!hasFallback) return;

    const [tasks, templates, settings, occurrences] = await Promise.all([
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
      templates: mergeById(templates, fallback.templates, normalizeTemplate).filter(
        (template) => template.label,
      ),
      occurrences: mergeById(occurrences, fallback.occurrences, normalizeOccurrence).filter(Boolean),
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
      const [tasks, templates, settings, occurrences] = await Promise.all([
        getAllRecords("tasks"),
        getAllRecords("templates"),
        getAllRecords("settings"),
        getAllRecords("occurrences"),
      ]);

      state.tasks = tasks.map(normalizeTask).filter((task) => task.label);
      state.templates = templates.map(normalizeTemplate).filter((template) => template.label);
      state.occurrences = occurrences.map(normalizeOccurrence).filter(Boolean);
      state.settings = normalizeSettings(settings.find((item) => item.id === "preferences"));
      state.lastDateKey = todayKey();

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

  function tasksForMaintenance() {
    return state.tasks.filter((task) => task.section === "maintenance");
  }

  function sortTasks(tasks) {
    const momentRank = { morning: 0, any: 1, evening: 2 };
    return [...tasks].sort((a, b) => {
      const completeDifference = Number(Boolean(a.completedAt)) - Number(Boolean(b.completedAt));
      if (completeDifference) return completeDifference;
      const overdueDifference = Number(a.dueDate >= todayKey()) - Number(b.dueDate >= todayKey());
      if (overdueDifference) return overdueDifference;
      const momentDifference = momentRank[a.moment] - momentRank[b.moment];
      if (momentDifference) return momentDifference;
      return a.position - b.position;
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

  function renderTaskList(container, tasks) {
    const fragment = document.createDocumentFragment();
    for (const task of sortTasks(tasks)) {
      const row = elements.taskTemplate.content.firstElementChild.cloneNode(true);
      const checkButton = row.querySelector(".check-button");
      const mainButton = row.querySelector(".task-main");
      const moreButton = row.querySelector(".task-more");

      row.dataset.taskId = task.id;
      row.classList.toggle("is-complete", Boolean(task.completedAt));
      row.classList.toggle(
        "is-overdue",
        task.section === "daily" && task.dueDate < todayKey() && !task.completedAt,
      );
      row.querySelector(".task-label").textContent = task.label;
      row.querySelector(".task-meta").textContent = taskMeta(task);
      checkButton.setAttribute(
        "aria-label",
        task.completedAt ? `Réouvrir : ${task.label}` : `Terminer : ${task.label}`,
      );
      checkButton.addEventListener("click", () => toggleTask(task.id));
      mainButton.addEventListener("click", () => openTaskEditor(task.id));
      moreButton.addEventListener("click", () => openTaskEditor(task.id));
      fragment.append(row);
    }
    container.replaceChildren(fragment);
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

  function renderRoutineProgress(routine, target) {
    const tasks = tasksForToday().filter((task) => task.moment === routine);
    target.textContent = progressText(tasks);
  }

  function renderAll() {
    const todayTasks = tasksForToday();
    const tomorrowTasks = tasksForTomorrow();
    const maintenanceTasks = tasksForMaintenance();

    elements.currentDate.textContent = new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date());

    renderTaskList(elements.todayList, todayTasks);
    renderTaskList(elements.tomorrowList, tomorrowTasks);
    renderTaskList(elements.maintenanceList, maintenanceTasks);
    elements.todayProgress.textContent = progressText(todayTasks);
    elements.tomorrowProgress.textContent = progressText(tomorrowTasks);
    elements.maintenanceProgress.textContent = progressText(maintenanceTasks);
    elements.emptyAddToday.hidden = todayTasks.length > 0;
    elements.emptyAddTomorrow.hidden = tomorrowTasks.length > 0;
    elements.emptyAddMaintenance.hidden = maintenanceTasks.length > 0;
    renderRoutineProgress("morning", elements.morningProgress);
    renderRoutineProgress("evening", elements.eveningProgress);
    renderTemplates("morning");
    renderTemplates("evening");
    elements.autoMorning.checked = state.settings.autoMorning;
    elements.autoEvening.checked = state.settings.autoEvening;
    renderQuickTarget();
  }

  function renderQuickTarget() {
    const targets = {
      today: ["Aujourd’hui", "Ajouter à aujourd’hui. Appuyer pour choisir demain"],
      tomorrow: ["Demain", "Ajouter à demain. Appuyer pour choisir Entretien / travaux"],
      maintenance: ["Entretien", "Ajouter à Entretien / travaux. Appuyer pour choisir aujourd’hui"],
    };
    const [label, ariaLabel] = targets[state.settings.quickTarget];
    elements.quickTarget.textContent = label;
    elements.quickTarget.setAttribute("aria-label", ariaLabel);
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
      announceChange();
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
    const isMaintenance = state.settings.quickTarget === "maintenance";
    const task = {
      id: makeId("task"),
      label: cleanLabel,
      dueDate: state.settings.quickTarget === "tomorrow" ? tomorrowKey() : todayKey(),
      section: isMaintenance ? "maintenance" : "daily",
      moment: "any",
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      position: Date.now(),
      templateId: null,
      occurrenceKey: null,
    };
    try {
      await putRecord("tasks", task);
      state.tasks.push(task);
      announceChange();
      renderAll();
      return true;
    } catch (error) {
      console.error(error);
      showToast("Tâche non enregistrée");
      return false;
    }
  }

  async function toggleTask(id) {
    const task = state.tasks.find((item) => item.id === id);
    if (!task) return;
    const nextTask = {
      ...task,
      completedAt: task.completedAt ? null : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await putRecord("tasks", nextTask);
      state.tasks = state.tasks.map((item) => (item.id === id ? nextTask : item));
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
    elements.momentFieldset.hidden = selectedList?.value === "maintenance";
  }

  function openTaskEditor(id) {
    const task = state.tasks.find((item) => item.id === id);
    if (!task) return;
    state.activeTaskId = id;
    elements.editTaskLabel.value = task.label;
    const taskList =
      task.section === "maintenance"
        ? "maintenance"
        : task.dueDate === tomorrowKey()
          ? "tomorrow"
          : "today";
    const selectedList = elements.editTaskForm.querySelector(
      `input[name="task-list"][value="${taskList}"]`,
    );
    if (selectedList) selectedList.checked = true;
    const moment = ["morning", "evening"].includes(task.moment) ? task.moment : "any";
    const selectedMoment = elements.editTaskForm.querySelector(`input[name="moment"][value="${moment}"]`);
    if (selectedMoment) selectedMoment.checked = true;
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
    const taskList = QUICK_TARGET_ORDER.includes(selectedList?.value) ? selectedList.value : "today";
    const isMaintenance = taskList === "maintenance";
    const nextTask = {
      ...task,
      label: cleanLabel,
      dueDate: taskList === "tomorrow" ? tomorrowKey() : todayKey(),
      section: isMaintenance ? "maintenance" : "daily",
      moment: isMaintenance ? "any" : selectedMoment?.value || "any",
      updatedAt: new Date().toISOString(),
    };
    try {
      await putRecord("tasks", nextTask);
      state.tasks = state.tasks.map((item) => (item.id === task.id ? nextTask : item));
      announceChange();
      elements.taskDialog.close();
      state.activeTaskId = null;
      renderAll();
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
    let created = 0;
    let needsRefresh = false;

    for (const [index, template] of templates.entries()) {
      const occurrenceKey = `${template.id}:${date}`;
      if (existingKeys.has(occurrenceKey) || dismissedKeys.has(occurrenceKey)) continue;
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
        templateId: template.id,
        occurrenceKey,
      };
      try {
        const wasCreated = await createRoutineTaskIfAllowed(task);
        if (wasCreated) {
          state.tasks.push(task);
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
    if (!elements.settingsDialog.open) elements.settingsDialog.showModal();
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
      version: 2,
      exportedAt: new Date().toISOString(),
      tasks: state.tasks,
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
      if (![1, 2].includes(payload?.version) || !Array.isArray(payload.tasks) || !Array.isArray(payload.templates)) {
        throw new Error("Format non reconnu");
      }

      const nextState = {
        tasks: payload.tasks.map(normalizeTask).filter((task) => task.label),
        templates: payload.templates.map(normalizeTemplate).filter((template) => template.label),
        occurrences: Array.isArray(payload.occurrences)
          ? payload.occurrences.map(normalizeOccurrence).filter(Boolean)
          : [],
        settings: normalizeSettings(payload.settings),
      };
      const previousState = {
        tasks: [...state.tasks],
        templates: [...state.templates],
        occurrences: [...state.occurrences],
        settings: { ...state.settings },
      };
      const confirmed = window.confirm("Remplacer les tâches actuelles par cette sauvegarde ?");
      if (!confirmed) return;
      await replaceAllData(nextState);
      announceChange();
      await loadState();
      elements.settingsDialog.close();
      showToast("Sauvegarde restaurée", "Annuler", async () => {
        try {
          await replaceAllData(previousState);
          announceChange();
          await loadState();
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
    const confirmed = window.confirm(`Effacer ${completed.length} tâche${completed.length > 1 ? "s" : ""} terminée${completed.length > 1 ? "s" : ""} ?`);
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
      showToast("Tâches terminées effacées", "Annuler", async () => {
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

  function bindEvents() {
    elements.quickAddForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const label = elements.quickInput.value;
      if (!label.trim()) return;
      const saved = await addQuickTask(label);
      if (saved) elements.quickInput.value = "";
      elements.quickInput.focus();
    });

    elements.quickTarget.addEventListener("click", async () => {
      const currentIndex = QUICK_TARGET_ORDER.indexOf(state.settings.quickTarget);
      const quickTarget = QUICK_TARGET_ORDER[(currentIndex + 1) % QUICK_TARGET_ORDER.length];
      await updateSettings({ quickTarget });
      elements.quickInput.focus();
    });

    elements.emptyAddToday.addEventListener("click", async () => {
      await updateSettings({ quickTarget: "today" });
      elements.quickInput.focus();
    });

    elements.emptyAddTomorrow.addEventListener("click", async () => {
      await updateSettings({ quickTarget: "tomorrow" });
      elements.quickInput.focus();
    });

    elements.emptyAddMaintenance.addEventListener("click", async () => {
      await updateSettings({ quickTarget: "maintenance" });
      elements.quickInput.focus();
    });

    elements.morningRoutine.addEventListener("click", () => generateRoutine("morning"));
    elements.eveningRoutine.addEventListener("click", () => generateRoutine("evening"));
    elements.addMorningToday.addEventListener("click", () => generateRoutine("morning"));
    elements.addEveningToday.addEventListener("click", () => generateRoutine("evening"));

    elements.openSettings.addEventListener("click", () => elements.settingsDialog.showModal());
    elements.closeSettings.addEventListener("click", () => elements.settingsDialog.close());
    elements.settingsDialog.addEventListener("click", (event) => closeDialogOnBackdrop(elements.settingsDialog, event));

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
    elements.closeTaskDialog.addEventListener("click", () => elements.taskDialog.close());
    elements.taskDialog.addEventListener("click", (event) => closeDialogOnBackdrop(elements.taskDialog, event));
    elements.taskDialog.addEventListener("close", () => {
      state.activeTaskId = null;
    });
    elements.deleteTask.addEventListener("click", deleteActiveTask);

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
      if (document.visibilityState !== "visible") return;
      if (state.lastDateKey !== todayKey()) loadState();
      else renderAll();
    });

    syncChannel?.addEventListener("message", (event) => {
      if (event.data?.type === "refresh") loadState({ runAutomatic: false });
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

  async function start() {
    bindEvents();
    prepareInstallControl();
    registerServiceWorker();
    await migrateFallbackIfNeeded();
    await loadState();

    window.setInterval(() => {
      if (state.lastDateKey !== todayKey()) loadState();
    }, 60_000);

  }

  start().catch((error) => {
    console.error(error);
    showToast("Impossible de démarrer l’application");
  });
})();
