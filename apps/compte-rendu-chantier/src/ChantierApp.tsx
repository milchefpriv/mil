"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Keyboard,
  LoaderCircle,
  LogOut,
  MapPin,
  Mic,
  Pencil,
  Play,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { downloadReportPdf } from "@/lib/report-pdf";
import { downloadReportXlsx } from "@/lib/report-xlsx";
import { supabase } from "@/src/supabase";

type Screen = "home" | "live" | "review" | "document";

type SitePoint = {
  id: string;
  place: string;
  note: string;
  team: string;
  createdAt: string;
};

type Project = {
  id: string;
  name: string;
  address: string;
  details: string;
  siteStart: string;
  kitchenInstall: string;
  siteEnd: string;
  createdAt: string;
  updatedAt: string;
};

type ProjectDraft = Pick<
  Project,
  "name" | "address" | "details" | "siteStart" | "kitchenInstall" | "siteEnd"
>;

type Report = {
  id: string;
  projectId: string;
  meetingNumber: number;
  meetingDate: string;
  attendees: string;
  nextMeetingDate: string;
  nextMeetingTime: string;
  generalNotes: string;
  points: SitePoint[];
  status: "draft" | "final";
  startedAt: string;
  updatedAt: string;
};

type AppData = {
  version: 2;
  projects: Project[];
  reports: Report[];
};

type FirmProfile = {
  name: string;
  address: string;
  contact: string;
};

type LegacyReport = {
  id?: string;
  projectName?: string;
  projectAddress?: string;
  meetingNumber?: string;
  meetingDate?: string;
  attendees?: string;
  nextMeetingDate?: string;
  nextMeetingTime?: string;
  generalNotes?: string;
  points?: SitePoint[];
  updatedAt?: string;
};

type RecognitionResult = ArrayLike<{ transcript: string }> & {
  isFinal?: boolean;
};

type RecognitionResultEvent = {
  resultIndex?: number;
  results: ArrayLike<RecognitionResult>;
};

type RecognitionErrorEvent = {
  error?: string;
};

type RecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
};

type RecognitionConstructor = new () => RecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  }
}

const DATA_KEY = "espace-apprivoise-chantier-v2";
const LEGACY_REPORTS_KEY = "atelier-chantier-reports-v1";
const SYNCED_KEY = "espace-apprivoise-chantier-v2-synced";
const DIRTY_KEY = "espace-apprivoise-chantier-v2-dirty";

type SyncState = "loading" | "saving" | "saved" | "offline";

type DataResponse = {
  data: AppData | null;
  updatedAt: string | null;
};

const FIXED_WARNING =
  "RAPPEL : RESPECTER LES CONSIGNES DU CHANTIER ET DES PARTIES COMMUNES";
const FIXED_RETURN = "A RETOURNER VALIDE A L'ARCHITECTE";
const FIXED_LEGAL =
  "Conformément à l'usage vous pouvez, dans un délai de 8 jours à réception du présent compte-rendu, informer l'architecte des observations susceptibles d'être reprises au rendez-vous suivant, sinon il sera considéré que le présent compte rendu est approuvé";

const ROOM_PLACES = [
  "Tout l’appartement",
  "Cuisine",
  "Entrée",
  "Salon",
  "Salle à manger (SAM)",
  "SDB 1",
  "SDB 2",
  "Salle d’eau",
  "Chambre 1",
  "Chambre 2",
  "Dressing",
  "WC",
  "Dégagement",
  "Parties communes",
  "Extérieur / façade",
  "Cour",
  "Chez le voisin",
];

const TOPIC_PLACES = [
  "Électricité",
  "Plomberie",
  "Parquet",
  "Chape / sols",
  "Cloisons",
  "Menuiserie",
  "Fenêtres / stores",
  "VMC",
  "Chauffage",
  "Isolation",
  "Volets / stores",
  "Planning / RDV",
  "Déposes",
  "Copropriété",
  "Niveaux",
  "Mobilier",
  "Carrelage / crédence",
  "Nettoyage",
];

const DEFAULT_TEAMS = [
  "Entreprise",
  "Électricien",
  "Plombier",
  "Menuiserie",
  "Carreleur",
  "Plâtrier",
  "Chauffagiste",
  "Isolation",
  "Cliente",
  "Architecte",
  "Tous",
];

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function localDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function emptyProjectDraft(): ProjectDraft {
  return {
    name: "",
    address: "",
    details: "",
    siteStart: "",
    kitchenInstall: "",
    siteEnd: "",
  };
}

function makeProject(draft: ProjectDraft): Project {
  const now = new Date().toISOString();
  return { id: uid(), ...draft, createdAt: now, updatedAt: now };
}

function makeReport(
  projectId: string,
  meetingNumber: number,
  attendees: string,
): Report {
  const now = new Date().toISOString();
  return {
    id: uid(),
    projectId,
    meetingNumber,
    meetingDate: localDate(),
    attendees,
    nextMeetingDate: "",
    nextMeetingTime: "10:00",
    generalNotes: "",
    points: [],
    status: "draft",
    startedAt: now,
    updatedAt: now,
  };
}

function migrateLegacy(): AppData {
  const empty: AppData = { version: 2, projects: [], reports: [] };
  try {
    const raw = window.localStorage.getItem(LEGACY_REPORTS_KEY);
    if (!raw) return empty;
    const legacy = JSON.parse(raw) as LegacyReport[];
    if (!Array.isArray(legacy)) return empty;

    const projectsByKey = new Map<string, Project>();
    const reports: Report[] = [];
    legacy.forEach((item) => {
      const name = item.projectName?.trim() ?? "";
      const address = item.projectAddress?.trim() ?? "";
      const points = Array.isArray(item.points) ? item.points : [];
      if (!name && !address && points.length === 0) return;
      const key = `${name.toLocaleLowerCase("fr-FR")}::${address.toLocaleLowerCase("fr-FR")}`;
      let project = projectsByKey.get(key);
      if (!project) {
        project = makeProject({
          ...emptyProjectDraft(),
          name: name || "Projet sans titre",
          address,
        });
        projectsByKey.set(key, project);
      }
      const parsedNumber = Number.parseInt(item.meetingNumber ?? "1", 10);
      const now = item.updatedAt ?? new Date().toISOString();
      reports.push({
        id: item.id ?? uid(),
        projectId: project.id,
        meetingNumber: Number.isFinite(parsedNumber) ? parsedNumber : 1,
        meetingDate: item.meetingDate || localDate(),
        attendees: item.attendees ?? "",
        nextMeetingDate: item.nextMeetingDate ?? "",
        nextMeetingTime: item.nextMeetingTime ?? "10:00",
        generalNotes: item.generalNotes ?? "",
        points,
        status: "draft",
        startedAt: now,
        updatedAt: now,
      });
    });
    return { version: 2, projects: [...projectsByKey.values()], reports };
  } catch {
    return empty;
  }
}

function isAppData(value: unknown): value is AppData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AppData>;
  return (
    candidate.version === 2 &&
    Array.isArray(candidate.projects) &&
    Array.isArray(candidate.reports)
  );
}

function storageKey(base: string, userId: string) {
  return `${base}:${userId}`;
}

function readLocalData(userId: string): AppData {
  try {
    const raw =
      window.localStorage.getItem(storageKey(DATA_KEY, userId)) ??
      window.localStorage.getItem(DATA_KEY);
    if (!raw) return migrateLegacy();
    const parsed = JSON.parse(raw) as unknown;
    return isAppData(parsed) ? parsed : migrateLegacy();
  } catch {
    return migrateLegacy();
  }
}

function hasRecords(data: AppData) {
  return data.projects.length > 0 || data.reports.length > 0;
}

function mergeRecords<T extends { id: string; updatedAt: string }>(
  remote: T[],
  local: T[],
) {
  const records = new Map(remote.map((record) => [record.id, record]));
  local.forEach((localRecord) => {
    const remoteRecord = records.get(localRecord.id);
    if (!remoteRecord || localRecord.updatedAt >= remoteRecord.updatedAt) {
      records.set(localRecord.id, localRecord);
    }
  });
  return [...records.values()];
}

function mergeAppData(remote: AppData, local: AppData): AppData {
  return {
    version: 2,
    projects: mergeRecords(remote.projects, local.projects),
    reports: mergeRecords(remote.reports, local.reports),
  };
}

async function fetchRemoteData(userId: string): Promise<DataResponse> {
  const { data: row, error } = await supabase
    .from("chantier_workspaces")
    .select("data, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return {
    data: isAppData(row?.data) ? row.data : null,
    updatedAt: typeof row?.updated_at === "string" ? row.updated_at : null,
  };
}

async function saveRemoteData(userId: string, data: AppData) {
  const { error } = await supabase.from("chantier_workspaces").upsert({
    user_id: userId,
    data,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: "user_id",
  });
  if (error) throw error;
}

async function fetchFirmProfile(email: string): Promise<FirmProfile | null> {
  const { data, error } = await supabase
    .from("chantier_firm_profiles")
    .select("name, address, contact")
    .eq("email", email.toLocaleLowerCase())
    .maybeSingle();

  if (error) throw error;
  return data
    ? { name: data.name, address: data.address, contact: data.contact }
    : null;
}

async function saveFirmProfile(email: string, firm: FirmProfile) {
  const { error } = await supabase.from("chantier_firm_profiles").upsert({
    email: email.toLocaleLowerCase(),
    name: firm.name,
    address: firm.address,
    contact: firm.contact,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: "email",
  });
  if (error) throw error;
}

function formatDateLong(value: string) {
  if (!value) return "À définir";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatDateShort(value: string) {
  if (!value) return "À définir";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatDateNumeric(value: string, shortYear = false) {
  if (!value) return "A DEFINIR";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${shortYear ? year.slice(-2) : year}`;
}

function formatTime(value: string) {
  if (!value) return "";
  const [hours, minutes] = value.split(":");
  return minutes === "00" ? `${Number(hours)}h` : `${Number(hours)}h${minutes}`;
}

function nextMeetingSentence(report: Report) {
  if (!report.nextMeetingDate) return "PROCHAIN RDV DE CHANTIER A DEFINIR";
  const time = formatTime(report.nextMeetingTime);
  return `PROCHAIN RDV DE CHANTIER LE ${formatDateNumeric(report.nextMeetingDate, true)}${time ? ` à ${time}` : ""}`;
}

function safeFileName(value: string) {
  return (value || "chantier")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function rankedSuggestions(defaults: string[], used: string[], limit?: number) {
  const counts = new Map<string, number>();
  used.forEach((value) => {
    const clean = value.trim();
    if (clean) counts.set(clean, (counts.get(clean) ?? 0) + 1);
  });
  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value]) => value);
  const result = [...new Set([...ranked, ...defaults])];
  return typeof limit === "number" ? result.slice(0, limit) : result;
}

type ChantierAppProps = {
  user: {
    id: string;
    displayName: string;
    email: string;
  };
  onSignOut: () => void;
};

export default function ChantierApp({ user, onSignOut }: ChantierAppProps) {
  const [data, setData] = useState<AppData>({
    version: 2,
    projects: [],
    reports: [],
  });
  const [hydrated, setHydrated] = useState(false);
  const [firmHydrated, setFirmHydrated] = useState(false);
  const [firm, setFirm] = useState<FirmProfile>({
    name: "",
    address: "",
    contact: user.email,
  });
  const [firmDraft, setFirmDraft] = useState<FirmProfile>({
    name: "",
    address: "",
    contact: user.email,
  });
  const [firmSettingsOpen, setFirmSettingsOpen] = useState(false);
  const [firmSaving, setFirmSaving] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("loading");
  const [screen, setScreen] = useState<Screen>("home");
  const [activeReportId, setActiveReportId] = useState("");
  const [place, setPlace] = useState("");
  const [note, setNote] = useState("");
  const [team, setTeam] = useState("");
  const [listening, setListening] = useState(false);
  const [dictationStarting, setDictationStarting] = useState(false);
  const [dictationHelpOpen, setDictationHelpOpen] = useState(false);
  const [pdfAction, setPdfAction] = useState<"save" | null>(null);
  const [xlsxGenerating, setXlsxGenerating] = useState(false);
  const [placePickerOpen, setPlacePickerOpen] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveQuery, setArchiveQuery] = useState("");
  const [launchOpen, setLaunchOpen] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [launchProjectId, setLaunchProjectId] = useState("");
  const [launchAttendees, setLaunchAttendees] = useState("");
  const [newProjectDraft, setNewProjectDraft] = useState<ProjectDraft>(
    emptyProjectDraft(),
  );
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editProjectDraft, setEditProjectDraft] = useState<ProjectDraft>(
    emptyProjectDraft(),
  );
  const [editingPoint, setEditingPoint] = useState<SitePoint | null>(null);
  const [deletePointId, setDeletePointId] = useState<string | null>(null);
  const [deleteReportId, setDeleteReportId] = useState<string | null>(null);
  const [clockTick, setClockTick] = useState(0);
  const recognitionRef = useRef<RecognitionInstance | null>(null);
  const dictationBaseRef = useRef("");
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);
  const initialSyncRef = useRef(false);
  const lastSavedSnapshotRef = useRef("");
  const saveVersionRef = useRef(0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    void (async () => {
      const fallback: FirmProfile = {
        name: user.displayName.includes("@")
          ? "Compte Rendu Chantier"
          : user.displayName,
        address: "",
        contact: user.email,
      };
      try {
        const stored = await fetchFirmProfile(user.email);
        const nextFirm = stored ?? fallback;
        if (!active) return;
        setFirm(nextFirm);
        setFirmDraft(nextFirm);
        if (!stored) await saveFirmProfile(user.email, nextFirm);
      } catch {
        if (active) {
          setFirm(fallback);
          setFirmDraft(fallback);
        }
      } finally {
        if (active) setFirmHydrated(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [user.displayName, user.email]);

  useEffect(() => {
    let active = true;
    const frame = window.requestAnimationFrame(() => {
      void (async () => {
        const localData = readLocalData(user.id);
        let nextData = localData;

        try {
          const remote = await fetchRemoteData(user.id);
          const syncedBefore =
            window.localStorage.getItem(storageKey(SYNCED_KEY, user.id)) === "1";
          const localIsDirty =
            window.localStorage.getItem(storageKey(DIRTY_KEY, user.id)) === "1";
          let needsUpload = false;

          if (remote.data) {
            if (localIsDirty || (!syncedBefore && hasRecords(localData))) {
              nextData = mergeAppData(remote.data, localData);
              needsUpload = JSON.stringify(nextData) !== JSON.stringify(remote.data);
            } else {
              nextData = remote.data;
            }
          } else {
            nextData = localData;
            needsUpload = true;
          }

          if (!active) return;
          setData(nextData);
          const snapshot = JSON.stringify(nextData);
          window.localStorage.setItem(storageKey(DATA_KEY, user.id), snapshot);

          if (needsUpload) {
            setSyncState("saving");
            await saveRemoteData(user.id, nextData);
          }

          if (!active) return;
          lastSavedSnapshotRef.current = snapshot;
          window.localStorage.setItem(storageKey(SYNCED_KEY, user.id), "1");
          window.localStorage.removeItem(storageKey(DIRTY_KEY, user.id));
          setSyncState("saved");
        } catch {
          if (!active) return;
          setData(localData);
          lastSavedSnapshotRef.current = "";
          setSyncState("offline");
        } finally {
          if (active) {
            initialSyncRef.current = true;
            setHydrated(true);
          }
        }
      })();
    });
    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
    };
  }, [user.id]);

  useEffect(() => {
    if (!hydrated || !initialSyncRef.current) return;

    const snapshot = JSON.stringify(data);
    try {
      window.localStorage.setItem(storageKey(DATA_KEY, user.id), snapshot);
      window.localStorage.setItem(storageKey(DIRTY_KEY, user.id), "1");
    } catch {
      // L'interface reste utilisable même si le stockage local est indisponible.
    }

    if (snapshot === lastSavedSnapshotRef.current) {
      try {
        window.localStorage.removeItem(storageKey(DIRTY_KEY, user.id));
      } catch {
        // La sauvegarde en ligne reste la source de vérité.
      }
      setSyncState("saved");
      return;
    }

    setSyncState("saving");
    const saveVersion = ++saveVersionRef.current;
    const timer = window.setTimeout(() => {
      saveQueueRef.current = saveQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          try {
            await saveRemoteData(user.id, data);
            if (saveVersion !== saveVersionRef.current) return;
            lastSavedSnapshotRef.current = snapshot;
            try {
              window.localStorage.setItem(storageKey(SYNCED_KEY, user.id), "1");
              window.localStorage.removeItem(storageKey(DIRTY_KEY, user.id));
            } catch {
              // La sauvegarde distante a bien réussi.
            }
            setSyncState("saved");
          } catch {
            if (saveVersion === saveVersionRef.current) {
              setSyncState("offline");
            }
          }
        });
    }, 550);

    return () => window.clearTimeout(timer);
  }, [data, hydrated, user.id]);

  useEffect(() => {
    if (!hydrated) return;
    let active = true;

    const refreshFromSupabase = async () => {
      if (document.hidden || syncState === "saving") return;
      if (
        window.localStorage.getItem(storageKey(DIRTY_KEY, user.id)) === "1"
      ) {
        return;
      }

      try {
        const remote = await fetchRemoteData(user.id);
        if (!active || !remote.data) return;
        const snapshot = JSON.stringify(remote.data);
        if (snapshot === lastSavedSnapshotRef.current) return;

        lastSavedSnapshotRef.current = snapshot;
        window.localStorage.setItem(storageKey(DATA_KEY, user.id), snapshot);
        window.localStorage.setItem(storageKey(SYNCED_KEY, user.id), "1");
        setData(remote.data);
        setSyncState("saved");
      } catch {
        if (active) setSyncState("offline");
      }
    };

    const onVisibilityChange = () => {
      if (!document.hidden) void refreshFromSupabase();
    };

    window.addEventListener("focus", refreshFromSupabase);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      window.removeEventListener("focus", refreshFromSupabase);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [hydrated, syncState, user.id]);

  useEffect(() => {
    if (screen !== "live") return;
    const refreshClock = () => setClockTick(new Date().getTime());
    const frame = window.requestAnimationFrame(refreshClock);
    const timer = window.setInterval(refreshClock, 30_000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, [screen]);

  useEffect(() => {
    return () =>
      recognitionRef.current?.abort
        ? recognitionRef.current.abort()
        : recognitionRef.current?.stop();
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [screen, activeReportId]);

  useEffect(() => {
    if (
      !launchOpen &&
      !archiveOpen &&
      !placePickerOpen &&
      !firmSettingsOpen &&
      !editingProjectId &&
      !editingPoint &&
      !dictationHelpOpen &&
      !deletePointId &&
      !deleteReportId
    ) {
      return;
    }
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        document
          .querySelectorAll<HTMLElement>(
            '[data-slot="dialog-content"][data-state="open"], [data-slot="sheet-content"][data-state="open"], [data-slot="alert-dialog-content"][data-state="open"]',
          )
          .forEach((element) => element.scrollTo({ top: 0, behavior: "auto" }));
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [
    archiveOpen,
    deletePointId,
    deleteReportId,
    dictationHelpOpen,
    editingPoint,
    editingProjectId,
    firmSettingsOpen,
    launchOpen,
    placePickerOpen,
  ]);

  const activeReport = data.reports.find(
    (report) => report.id === activeReportId,
  );
  const activeProject = activeReport
    ? data.projects.find((project) => project.id === activeReport.projectId)
    : undefined;

  const projectReports = useMemo(
    () =>
      activeProject
        ? data.reports.filter((report) => report.projectId === activeProject.id)
        : [],
    [activeProject, data.reports],
  );

  const placeSuggestions = useMemo(
    () =>
      rankedSuggestions(
        [...ROOM_PLACES, ...TOPIC_PLACES],
        projectReports.flatMap((report) => report.points.map((point) => point.place)),
      ),
    [projectReports],
  );

  const quickPlaces = useMemo(
    () =>
      rankedSuggestions(
        ["Cuisine", "Entrée", "Salon", "SDB 1", "SDB 2", "Chambre 1", "WC"],
        projectReports.flatMap((report) => report.points.map((point) => point.place)),
        8,
      ),
    [projectReports],
  );

  const teamSuggestions = useMemo(
    () =>
      rankedSuggestions(
        DEFAULT_TEAMS,
        projectReports.flatMap((report) => report.points.map((point) => point.team)),
        11,
      ),
    [projectReports],
  );

  const groupedPoints = useMemo(() => {
    const groups = new Map<string, SitePoint[]>();
    activeReport?.points.forEach((point) => {
      const key = point.place.trim() || "Lieu à préciser";
      groups.set(key, [...(groups.get(key) ?? []), point]);
    });
    return [...groups.entries()];
  }, [activeReport]);

  const sortedProjects = useMemo(
    () => [...data.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [data.projects],
  );

  const recentReports = useMemo(
    () => [...data.reports].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [data.reports],
  );

  const filteredArchive = useMemo(() => {
    const query = archiveQuery.trim().toLocaleLowerCase("fr-FR");
    if (!query) return recentReports;
    return recentReports.filter((report) => {
      const project = data.projects.find((item) => item.id === report.projectId);
      return `${project?.name ?? ""} ${project?.address ?? ""} ${report.meetingNumber}`
        .toLocaleLowerCase("fr-FR")
        .includes(query);
    });
  }, [archiveQuery, data.projects, recentReports]);

  function updateReport(reportId: string, patch: Partial<Report>) {
    setData((current) => ({
      ...current,
      reports: current.reports.map((report) =>
        report.id === reportId
          ? { ...report, ...patch, updatedAt: new Date().toISOString() }
          : report,
      ),
    }));
  }

  function updateActiveReport(patch: Partial<Report>) {
    if (activeReport) updateReport(activeReport.id, patch);
  }

  function openLaunch(projectId?: string) {
    const selected =
      (projectId && data.projects.find((project) => project.id === projectId)) ||
      sortedProjects[0];
    setLaunchProjectId(selected?.id ?? "");
    const lastReport = selected
      ? recentReports.find((report) => report.projectId === selected.id)
      : undefined;
    setLaunchAttendees(lastReport?.attendees ?? "");
    setCreatingProject(!selected);
    setNewProjectDraft(emptyProjectDraft());
    setLaunchOpen(true);
  }

  function selectLaunchProject(projectId: string) {
    setLaunchProjectId(projectId);
    setCreatingProject(false);
    const lastReport = recentReports.find((report) => report.projectId === projectId);
    setLaunchAttendees(lastReport?.attendees ?? "");
  }

  function startMeeting() {
    let projectId = launchProjectId;
    let nextProjects = data.projects;
    if (creatingProject) {
      if (!newProjectDraft.name.trim() || !newProjectDraft.address.trim()) {
        toast.error("Ajoutez le nom et l’adresse du chantier.");
        return;
      }
      const project = makeProject({
        ...newProjectDraft,
        name: newProjectDraft.name.trim(),
        address: newProjectDraft.address.trim(),
      });
      projectId = project.id;
      nextProjects = [project, ...data.projects];
    }
    if (!projectId) {
      toast.error("Choisissez un projet.");
      return;
    }
    const numbers = data.reports
      .filter((report) => report.projectId === projectId)
      .map((report) => report.meetingNumber);
    const nextNumber = numbers.length ? Math.max(...numbers) + 1 : 1;
    const report = makeReport(projectId, nextNumber, launchAttendees.trim());
    setData({
      version: 2,
      projects: nextProjects.map((project) =>
        project.id === projectId
          ? { ...project, updatedAt: new Date().toISOString() }
          : project,
      ),
      reports: [report, ...data.reports],
    });
    setActiveReportId(report.id);
    setPlace("");
    setTeam("");
    setNote("");
    setLaunchOpen(false);
    setScreen("live");
  }

  function openReport(report: Report) {
    setActiveReportId(report.id);
    setArchiveOpen(false);
    setPlace(report.points.at(-1)?.place ?? "");
    setTeam(report.points.at(-1)?.team ?? "");
    setNote("");
    setScreen(report.status === "final" ? "document" : "live");
  }

  function openProjectEditor(project: Project) {
    setEditingProjectId(project.id);
    setEditProjectDraft({
      name: project.name,
      address: project.address,
      details: project.details,
      siteStart: project.siteStart,
      kitchenInstall: project.kitchenInstall,
      siteEnd: project.siteEnd,
    });
  }

  function saveProject() {
    if (!editingProjectId) return;
    if (!editProjectDraft.name.trim() || !editProjectDraft.address.trim()) {
      toast.error("Le nom et l’adresse sont nécessaires.");
      return;
    }
    setData((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === editingProjectId
          ? {
              ...project,
              ...editProjectDraft,
              name: editProjectDraft.name.trim(),
              address: editProjectDraft.address.trim(),
              updatedAt: new Date().toISOString(),
            }
          : project,
      ),
    }));
    setEditingProjectId(null);
    toast.success("Projet mis à jour");
  }

  function commitPoint(pointPlace: string) {
    if (!activeReport) return;
    const point: SitePoint = {
      id: uid(),
      place: pointPlace,
      note: note.trim(),
      team: team.trim() || "À attribuer",
      createdAt: new Date().toISOString(),
    };
    setData((current) => ({
      ...current,
      reports: current.reports.map((report) =>
        report.id === activeReport.id
          ? {
              ...report,
              points: [...report.points, point],
              updatedAt: new Date().toISOString(),
            }
          : report,
      ),
    }));
    setNote("");
    if ("vibrate" in navigator) navigator.vibrate(35);
    toast.success(`Point ${activeReport.points.length + 1} ajouté`, {
      description: `${point.place} · ${point.team}`,
      action: {
        label: "Annuler",
        onClick: () =>
          setData((current) => ({
            ...current,
            reports: current.reports.map((report) =>
              report.id === activeReport.id
                ? {
                    ...report,
                    points: report.points.filter((item) => item.id !== point.id),
                    updatedAt: new Date().toISOString(),
                  }
                : report,
            ),
          })),
      },
    });
    if (window.matchMedia("(pointer: fine)").matches) {
      window.setTimeout(
        () => noteInputRef.current?.focus({ preventScroll: true }),
        60,
      );
    }
  }

  function addPoint() {
    if (!activeReport) return;
    if (!place.trim()) {
      toast.error("Choisissez un lieu.");
      setPlacePickerOpen(true);
      return;
    }
    if (!note.trim()) {
      toast.error("Dictez ou écrivez le point à noter.");
      noteInputRef.current?.focus({ preventScroll: true });
      return;
    }
    commitPoint(place.trim());
  }

  function addFlashPoint() {
    if (!note.trim()) {
      toast.error("Dictez ou écrivez le point à noter.");
      noteInputRef.current?.focus({ preventScroll: true });
      return;
    }
    commitPoint(place.trim() || "Lieu à préciser");
  }

  function toggleTeam(item: string) {
    const selected = team
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    setTeam(
      selected.includes(item)
        ? selected.filter((value) => value !== item).join(", ")
        : [...selected, item].join(", "),
    );
  }

  function isTeamSelected(item: string) {
    return team
      .split(",")
      .map((value) => value.trim())
      .includes(item);
  }

  function startDictation() {
    if (listening || dictationStarting) {
      recognitionRef.current?.stop();
      setDictationStarting(false);
      return;
    }
    const Recognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setDictationHelpOpen(true);
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "fr-FR";
    recognition.continuous = true;
    recognition.interimResults = true;
    dictationBaseRef.current = note.trim();
    recognition.onstart = () => {
      setDictationStarting(false);
      setListening(true);
      toast.success("Micro activé — parlez normalement");
    };
    recognition.onresult = (event) => {
      const transcripts: string[] = [];
      for (let index = 0; index < event.results.length; index += 1) {
        const transcript = event.results[index]?.[0]?.transcript?.trim();
        if (transcript) transcripts.push(transcript);
      }
      const dictated = transcripts.join(" ").trim();
      const base = dictationBaseRef.current;
      setNote(`${base}${base && dictated ? " " : ""}${dictated}`);
    };
    recognition.onend = () => {
      setDictationStarting(false);
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.onerror = (event) => {
      setDictationStarting(false);
      setListening(false);
      recognitionRef.current = null;
      if (event.error === "aborted") return;
      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        setDictationHelpOpen(true);
        return;
      }
      if (event.error === "no-speech") {
        toast.error("Je n’ai rien entendu. Touchez le micro et réessayez.");
        return;
      }
      if (event.error === "audio-capture") {
        toast.error("Le micro est déjà utilisé ou indisponible.");
        return;
      }
      toast.error("La dictée n’a pas pu démarrer. Réessayez dans Safari.");
    };
    recognitionRef.current = recognition;
    setDictationStarting(true);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setDictationStarting(false);
      setListening(false);
      setDictationHelpOpen(true);
    }
  }

  function saveEditedPoint() {
    if (!activeReport || !editingPoint) return;
    if (!editingPoint.note.trim()) {
      toast.error("Ajoutez le texte du point avant d’enregistrer.");
      return;
    }
    updateReport(activeReport.id, {
      points: activeReport.points.map((point) =>
        point.id === editingPoint.id
          ? {
              ...editingPoint,
              place: editingPoint.place.trim() || "Lieu à préciser",
              team: editingPoint.team.trim() || "À attribuer",
            }
          : point,
      ),
    });
    setEditingPoint(null);
    toast.success("Point modifié");
  }

  function requestPointDeletion(pointId: string) {
    setEditingPoint(null);
    window.requestAnimationFrame(() => setDeletePointId(pointId));
  }

  function requestReportDeletion(reportId: string) {
    setArchiveOpen(false);
    window.requestAnimationFrame(() => setDeleteReportId(reportId));
  }

  function deletePoint() {
    if (!activeReport || !deletePointId) return;
    updateReport(activeReport.id, {
      points: activeReport.points.filter((point) => point.id !== deletePointId),
    });
    setDeletePointId(null);
    setEditingPoint(null);
    toast.success("Point supprimé");
  }

  function deleteReport() {
    if (!deleteReportId) return;
    setData((current) => ({
      ...current,
      reports: current.reports.filter((report) => report.id !== deleteReportId),
    }));
    if (activeReportId === deleteReportId) {
      setActiveReportId("");
      setScreen("home");
    }
    setDeleteReportId(null);
    toast.success("Compte rendu supprimé");
  }

  function openFirmSettings() {
    setFirmDraft(firm);
    setFirmSettingsOpen(true);
  }

  async function saveFirmSettings() {
    const nextFirm = {
      name: firmDraft.name.trim(),
      address: firmDraft.address.trim(),
      contact: firmDraft.contact.trim(),
    };
    if (!nextFirm.name) {
      toast.error("Ajoutez le nom à afficher sur le compte rendu.");
      return;
    }
    setFirmSaving(true);
    try {
      await saveFirmProfile(user.email, nextFirm);
      setFirm(nextFirm);
      setFirmDraft(nextFirm);
      setFirmSettingsOpen(false);
      toast.success("Coordonnées mises à jour");
    } catch {
      toast.error("Les coordonnées n’ont pas pu être enregistrées.");
    } finally {
      setFirmSaving(false);
    }
  }

  function finishMeeting() {
    if (!activeReport) return;
    updateReport(activeReport.id, { status: "final" });
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    toast.success(`Réunion terminée — CR n°${activeReport.meetingNumber} finalisé`);
  }

  async function deliverPdf() {
    if (!activeReport || !activeProject || pdfAction) return;
    setPdfAction("save");
    try {
      const delivery = await downloadReportPdf(
        {
          firm,
          fixedWarning: FIXED_WARNING,
          fixedReturn: FIXED_RETURN,
          fixedLegal: FIXED_LEGAL,
          project: activeProject,
          report: {
            meetingNumber: activeReport.meetingNumber,
            meetingDate: activeReport.meetingDate,
            attendees: activeReport.attendees,
            nextMeetingSentence: nextMeetingSentence(activeReport),
            generalNotes: activeReport.generalNotes,
            points: activeReport.points,
          },
        },
        `CR-${safeFileName(activeProject.name)}-${activeReport.meetingNumber}.pdf`,
        "auto",
      );
      if (delivery === "downloaded") toast.success("PDF téléchargé");
      if (delivery === "shared") {
        toast.success("PDF prêt à être enregistré ou envoyé");
      }
    } catch {
      toast.error("Le PDF n’a pas pu être créé. Réessayez dans un instant.");
    } finally {
      setPdfAction(null);
    }
  }

  async function exportXlsx() {
    if (!activeReport || !activeProject || xlsxGenerating) return;
    setXlsxGenerating(true);
    try {
      const delivery = await downloadReportXlsx(
        {
          firm,
          fixedWarning: FIXED_WARNING,
          fixedReturn: FIXED_RETURN,
          fixedLegal: FIXED_LEGAL,
          project: activeProject,
          report: {
            meetingNumber: activeReport.meetingNumber,
            meetingDate: activeReport.meetingDate,
            attendees: activeReport.attendees,
            nextMeetingSentence: nextMeetingSentence(activeReport),
            generalNotes: activeReport.generalNotes,
            points: activeReport.points,
          },
        },
        `CR-${safeFileName(activeProject.name)}-${activeReport.meetingNumber}.xlsx`,
      );
      if (delivery === "downloaded") {
        toast.success("Fichier Excel .xlsx téléchargé");
      }
      if (delivery === "shared") {
        toast.success("Fichier Excel prêt à être enregistré ou envoyé");
      }
    } catch {
      toast.error("Le fichier Excel n’a pas pu être créé.");
    } finally {
      setXlsxGenerating(false);
    }
  }

  function elapsedLabel(startedAt: string) {
    const minutes = Math.max(
      0,
      Math.floor(
        ((clockTick || new Date(startedAt).getTime()) -
          new Date(startedAt).getTime()) /
          60_000,
      ),
    );
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  }

  const syncLabel =
    syncState === "saved"
      ? "À jour sur tous vos appareils"
      : syncState === "saving"
        ? "Enregistrement en ligne…"
        : syncState === "loading"
          ? "Récupération des données…"
          : "Hors ligne · conservé sur cet appareil";

  const syncShortLabel =
    syncState === "saved"
      ? "Synchronisé"
      : syncState === "offline"
        ? "Hors ligne"
        : "Synchronisation…";

  if (!hydrated || !firmHydrated) {
    return (
      <main className="loading-screen">
        <div className="loading-mark">CR</div>
        <p>Récupération de vos chantiers…</p>
      </main>
    );
  }

  const meetingMissing = screen !== "home" && (!activeReport || !activeProject);

  return (
    <main className={`app-shell screen-${screen}`}>
      <Toaster richColors position="top-center" />

      {screen === "home" && (
        <div className="home-screen no-print">
          <header className="home-header">
            <div className="firm-mini-mark">CR</div>
            <div className="firm-mini-copy">
              <strong>{firm.name || "Compte Rendu Chantier"}</strong>
              <span title={`Connecté : ${user.displayName} (${user.email})`}>
                {user.displayName} · {syncShortLabel}
              </span>
            </div>
            <div className="home-header-actions">
              <Button
                variant="outline"
                size="icon"
                aria-label="Coordonnées du document"
                title="Coordonnées du document"
                onClick={openFirmSettings}
              >
                <Settings2 size={17} />
              </Button>
              <Button variant="outline" onClick={() => setArchiveOpen(true)}>
                <Archive size={17} />
                <span>Archives</span>
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Se déconnecter"
                title={`Se déconnecter de ${user.email}`}
                onClick={onSignOut}
              >
                <LogOut size={17} />
              </Button>
            </div>
          </header>

          <section className="home-hero">
            <div className="hero-copy">
              <Badge variant="outline">
                <CalendarDays size={13} /> {formatDateLong(localDate())}
              </Badge>
              <h1>Prête pour la<br />réunion de chantier&nbsp;?</h1>
              <p>
                L’adresse, la date et le numéro du compte rendu seront préparés
                automatiquement. Il ne restera qu’à écouter et noter.
              </p>
              <Button className="launch-meeting-button" onClick={() => openLaunch()}>
                <span className="launch-icon"><Play size={22} fill="currentColor" /></span>
                <span>
                  <small>Mode saisie rapide</small>
                  Lancer une nouvelle réunion
                </span>
                <ChevronRight size={20} />
              </Button>
            </div>
            <div className="hero-visual" aria-hidden="true">
              <div className="orbit orbit-one"><span>Cuisine</span></div>
              <div className="orbit orbit-two"><span>Électricien</span></div>
              <div className="orbit orbit-three"><span>SDB 1</span></div>
              <div className="hero-number">
                <Zap size={25} />
                <strong>3</strong>
                <span>gestes par point</span>
              </div>
            </div>
          </section>

          {recentReports.some((report) => report.status === "draft") && (
            <section className="resume-band">
              <div className="live-dot" />
              <div>
                <span>Réunion en cours</span>
                <strong>
                  {data.projects.find(
                    (project) =>
                      project.id ===
                      recentReports.find((report) => report.status === "draft")?.projectId,
                  )?.name ?? "Chantier"}
                </strong>
              </div>
              <Button
                onClick={() => {
                  const draft = recentReports.find((report) => report.status === "draft");
                  if (draft) openReport(draft);
                }}
              >
                Reprendre <ChevronRight size={16} />
              </Button>
            </section>
          )}

          <section className="projects-section">
            <div className="home-section-heading">
              <div>
                <span>Projets</span>
                <h2>Vos chantiers</h2>
              </div>
              {data.projects.length > 0 && (
                <Button variant="ghost" onClick={() => openLaunch()}>
                  <Plus size={16} /> Nouveau
                </Button>
              )}
            </div>

            {sortedProjects.length === 0 ? (
              <button className="empty-project-card" onClick={() => openLaunch()}>
                <span><Building2 size={22} /></span>
                <strong>Créer le premier chantier</strong>
                <small>Les informations ne seront demandées qu’une seule fois.</small>
              </button>
            ) : (
              <div className="project-cards">
                {sortedProjects.map((project) => {
                  const reports = recentReports.filter(
                    (report) => report.projectId === project.id,
                  );
                  const latest = reports[0];
                  return (
                    <article className="project-card" key={project.id}>
                      <div className="project-accent" />
                      <header>
                        <div className="project-icon"><Building2 size={18} /></div>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Modifier le projet"
                          onClick={() => openProjectEditor(project)}
                        >
                          <Settings2 size={16} />
                        </Button>
                      </header>
                      <h3>{project.name}</h3>
                      <p>{project.address}</p>
                      <div className="project-card-meta">
                        <span>{reports.length} CR</span>
                        <span>{latest ? `Dernier : ${formatDateShort(latest.meetingDate)}` : "Aucune réunion"}</span>
                      </div>
                      <Button onClick={() => openLaunch(project.id)}>
                        <Play size={15} fill="currentColor" /> Lancer le prochain CR
                      </Button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {recentReports.length > 0 && (
            <section className="recent-section">
              <div className="home-section-heading">
                <div>
                  <span>Historique</span>
                  <h2>Derniers comptes rendus</h2>
                </div>
                <Button variant="ghost" onClick={() => setArchiveOpen(true)}>
                  Tout voir <ChevronRight size={16} />
                </Button>
              </div>
              <div className="recent-report-list">
                {recentReports.slice(0, 4).map((report) => {
                  const project = data.projects.find(
                    (item) => item.id === report.projectId,
                  );
                  return (
                    <button key={report.id} onClick={() => openReport(report)}>
                      <span className={`report-status ${report.status}`}>
                        {report.status === "final" ? <Check size={14} /> : <Pencil size={14} />}
                      </span>
                      <span className="report-list-copy">
                        <strong>{project?.name ?? "Projet"}</strong>
                        <small>CR n°{report.meetingNumber} · {formatDateShort(report.meetingDate)}</small>
                      </span>
                      <Badge variant="secondary">{report.points.length} points</Badge>
                      <ChevronRight size={17} />
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {meetingMissing && (
        <section className="meeting-missing no-print">
          <ClipboardList size={26} />
          <h2>Ce compte rendu n’est plus disponible.</h2>
          <Button onClick={() => setScreen("home")}>Retour à l’accueil</Button>
        </section>
      )}

      {!meetingMissing && activeReport && activeProject && screen !== "home" && (
        <>
          <header className="meeting-header no-print">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Retour à l’accueil"
              onClick={() => setScreen("home")}
            >
              <ArrowLeft size={19} />
            </Button>
            <div className="meeting-title">
              <span className="meeting-live-label">
                {activeReport.status === "draft" && <i />}
                CR n°{activeReport.meetingNumber}
                <b className="meeting-phase">
                  {screen === "live"
                    ? "Saisie"
                    : screen === "review"
                      ? "Relecture"
                      : "Document"}
                </b>
              </span>
              <strong>{activeProject.name}</strong>
            </div>
            <div className={`autosave-state sync-${syncState}`} title={syncLabel}>
              {syncState === "saving" || syncState === "loading" ? (
                <LoaderCircle className="sync-spinner" size={14} />
              ) : (
                <Check size={14} />
              )}
              <span>{syncLabel}</span>
            </div>
            {screen === "live" && (
              <Button variant="outline" onClick={() => setScreen("review")}>
                Relire <Badge>{activeReport.points.length}</Badge>
              </Button>
            )}
            {screen !== "live" && (
              <Button variant="outline" onClick={() => setScreen("live")}>
                <Plus size={16} /> Ajouter
              </Button>
            )}
          </header>

          {screen === "live" && (
            <div className="live-workspace no-print">
              <section className="rapid-capture">
                <header className="capture-topline">
                  <div>
                    <span>Réunion en cours</span>
                    <strong>Point n°{String(activeReport.points.length + 1).padStart(2, "0")}</strong>
                  </div>
                  <div className="meeting-timer">
                    <Clock3 size={15} /> {elapsedLabel(activeReport.startedAt)}
                  </div>
                </header>

                <div className="rapid-step location-step">
                  <div className="rapid-label">
                    <span>1</span>
                    <div><strong>Où&nbsp;?</strong><small>Gardé pour le point suivant</small></div>
                  </div>
                  <div className="quick-chip-grid">
                    {quickPlaces.map((item) => (
                      <button
                        key={item}
                        className={place === item ? "is-selected" : ""}
                        onClick={() => setPlace(item)}
                      >
                        {place === item && <Check size={13} />}{item}
                      </button>
                    ))}
                    <button className="more-chip" onClick={() => setPlacePickerOpen(true)}>
                      <Search size={14} /> Tous
                    </button>
                  </div>
                  {place && (
                    <div className="current-choice"><MapPin size={14} /> Lieu retenu : <strong>{place}</strong></div>
                  )}
                </div>

                <div className="rapid-step note-step">
                  <div className="rapid-label">
                    <span>2</span>
                    <div><strong>Quoi&nbsp;?</strong><small>Une phrase suffit</small></div>
                  </div>
                  <div className={`rapid-note-box ${listening ? "is-listening" : ""}`}>
                    <Textarea
                      ref={noteInputRef}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Dictez ou écrivez ce qui vient d’être décidé…"
                      onKeyDown={(event) => {
                        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                          addPoint();
                        }
                      }}
                    />
                    <Button
                      className="big-mic-button"
                      variant={listening ? "default" : "outline"}
                      onClick={startDictation}
                      aria-pressed={listening}
                    >
                      {dictationStarting ? (
                        <LoaderCircle className="spinning-icon" size={21} />
                      ) : (
                        <Mic size={21} />
                      )}
                      <span>
                        {dictationStarting
                          ? "Activation…"
                          : listening
                            ? "Arrêter"
                            : "Dicter"}
                      </span>
                    </Button>
                  </div>
                </div>

                <div className="rapid-step team-step">
                  <div className="rapid-label">
                    <span>3</span>
                    <div><strong>Qui&nbsp;?</strong><small>Facultatif</small></div>
                  </div>
                  <div className="team-chips">
                    {teamSuggestions.map((item) => (
                      <button
                        key={item}
                        className={isTeamSelected(item) ? "is-selected" : ""}
                        onClick={() => toggleTeam(item)}
                      >
                        {isTeamSelected(item) && <Check size={12} />}
                        {item}
                      </button>
                    ))}
                  </div>
                  <label className="custom-team-field">
                    <Users size={16} />
                    <Input
                      value={team}
                      onChange={(event) => setTeam(event.target.value)}
                      placeholder="Ou écrire un nom / plusieurs équipes…"
                    />
                    {team && <button onClick={() => setTeam("")}><X size={15} /></button>}
                  </label>
                </div>

                <div className="capture-action-zone">
                  <Button className="capture-add-button" onClick={addPoint}>
                    <Plus size={20} />
                    <span>Ajouter le point</span>
                    <kbd>{activeReport.points.length + 1}</kbd>
                  </Button>
                  <Button className="flash-note-button" variant="ghost" onClick={addFlashPoint}>
                    <Zap size={15} /> Note éclair — compléter plus tard
                  </Button>
                  <small>Le lieu et l’équipe restent sélectionnés pour aller plus vite.</small>
                </div>
              </section>

              <aside className="live-sidebar">
                <header>
                  <div>
                    <span>En direct</span>
                    <strong>{activeReport.points.length} point{activeReport.points.length > 1 ? "s" : ""}</strong>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setScreen("review")}>
                    Tout relire
                  </Button>
                </header>
                <div className="live-points">
                  {activeReport.points.length === 0 ? (
                    <div className="live-empty">
                      <Sparkles size={21} />
                      <p>Le premier point apparaîtra ici instantanément.</p>
                    </div>
                  ) : (
                    [...activeReport.points].reverse().slice(0, 7).map((point) => {
                      const index = activeReport.points.findIndex((item) => item.id === point.id);
                      return (
                        <button key={point.id} onClick={() => setEditingPoint(point)}>
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <div>
                            <small>{point.place} · {point.team}</small>
                            <strong>{point.note}</strong>
                          </div>
                          <Pencil size={14} />
                        </button>
                      );
                    })
                  )}
                </div>
                <Button className="finish-capture-button" onClick={() => setScreen("review")}>
                  <ClipboardCheck size={17} /> Relire et terminer
                </Button>
              </aside>
            </div>
          )}

          {screen === "review" && (
            <div className="review-workspace no-print">
              <section className="review-intro">
                <div>
                  <Badge variant="outline"><ClipboardCheck size={13} /> Vérification</Badge>
                  <h1>Un dernier coup d’œil.</h1>
                  <p>Les points sont regroupés par lieu. Touchez une ligne pour la corriger.</p>
                </div>
                <div className="review-score">
                  <strong>{activeReport.points.length}</strong>
                  <span>points saisis</span>
                </div>
              </section>

              {activeReport.points.length === 0 ? (
                <section className="review-empty">
                  <ClipboardList size={25} />
                  <h2>Aucun point pour cette réunion</h2>
                  <Button onClick={() => setScreen("live")}>Ajouter le premier point</Button>
                </section>
              ) : (
                <div className="review-groups">
                  {groupedPoints.map(([groupPlace, points]) => (
                    <section className="review-group" key={groupPlace}>
                      <header>
                        <div><MapPin size={16} /><h2>{groupPlace}</h2></div>
                        <span>{points.length}</span>
                      </header>
                      <div>
                        {points.map((point) => {
                          const index = activeReport.points.findIndex((item) => item.id === point.id);
                          return (
                            <button className="review-point" key={point.id} onClick={() => setEditingPoint(point)}>
                              <span className="review-number">{String(index + 1).padStart(2, "0")}</span>
                              <span className="review-copy">
                                <strong>{point.note}</strong>
                                <small><Building2 size={12} /> {point.team}</small>
                              </span>
                              <Pencil size={15} />
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}

              <section className="review-actions">
                <Button variant="outline" onClick={() => setScreen("live")}>
                  <Plus size={17} /> Ajouter un point
                </Button>
                <Button onClick={() => setScreen("document")}>
                  Finaliser le compte rendu <ChevronRight size={17} />
                </Button>
              </section>
            </div>
          )}

          {screen === "document" && (
            <div className="document-workspace">
              <aside className="document-controls no-print">
                <div className="document-controls-heading">
                  <Badge variant="outline"><FileText size={13} /> Dernière étape</Badge>
                  <h2>Finaliser le compte rendu</h2>
                  <p>Terminez la réunion, puis enregistrez le document.</p>
                </div>
                {activeReport.status === "draft" ? (
                  <Button className="complete-report-button" onClick={finishMeeting}>
                    <CheckCircle2 size={18} /> Terminer la réunion
                  </Button>
                ) : (
                  <Button className="complete-report-button is-final" onClick={() => setScreen("home")}>
                    <CheckCircle2 size={18} /> Réunion terminée · Retour à l’accueil
                  </Button>
                )}
                <div className="document-fields">
                  <div className="document-section-label">
                    <span>Informations à vérifier</span>
                    <small>Chaque modification apparaît dans l’aperçu.</small>
                  </div>
                  <label className="field">
                    <span>Présents</span>
                    <Textarea
                      value={activeReport.attendees}
                      onChange={(event) => updateActiveReport({ attendees: event.target.value })}
                      placeholder="Noms des personnes présentes"
                    />
                  </label>
                  <div className="next-date-fields">
                    <label className="field">
                      <span>Date du prochain RDV</span>
                      <Input
                        type="date"
                        value={activeReport.nextMeetingDate}
                        onChange={(event) => updateActiveReport({ nextMeetingDate: event.target.value })}
                      />
                    </label>
                    <label className="field time-field">
                      <span>Heure</span>
                      <Input
                        type="time"
                        value={activeReport.nextMeetingTime}
                        onChange={(event) => updateActiveReport({ nextMeetingTime: event.target.value })}
                      />
                    </label>
                  </div>
                  <div className="generated-sentence">
                    <Sparkles size={16} />
                    <p>
                      {nextMeetingSentence(activeReport)}
                    </p>
                  </div>
                  <label className="field">
                    <span>Note supplémentaire <i>facultatif</i></span>
                    <Textarea
                      value={activeReport.generalNotes}
                      onChange={(event) => updateActiveReport({ generalNotes: event.target.value })}
                      placeholder="Une information hors tableau…"
                    />
                  </label>
                </div>
                <div className="document-section-label export-label">
                  <span>Enregistrer le document</span>
                  <small>Choisissez le format dont vous avez besoin.</small>
                </div>
                <div className="document-export-buttons">
                  <Button onClick={deliverPdf} disabled={pdfAction !== null}>
                    {pdfAction === "save" ? (
                      <LoaderCircle className="spinning-icon" size={17} />
                    ) : (
                      <Download size={17} />
                    )}
                    {pdfAction === "save" ? "Création du PDF…" : "Enregistrer le PDF"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={exportXlsx}
                    disabled={xlsxGenerating}
                  >
                    {xlsxGenerating ? (
                      <LoaderCircle className="spinning-icon" size={17} />
                    ) : (
                      <FileSpreadsheet size={17} />
                    )}
                    {xlsxGenerating ? "Création du .xlsx…" : "Excel (.xlsx)"}
                  </Button>
                </div>
              </aside>

              <section className="paper-stage">
                <header className="paper-stage-header no-print">
                  <div>
                    <span>Aperçu du document</span>
                    <strong>{activeProject.name} · CR n°{activeReport.meetingNumber}</strong>
                  </div>
                  <Badge variant="secondary">Format A4</Badge>
                </header>
                <article className="chantier-paper" id="report-preview">
                  <div className="cr-top-row">
                    <div className="architect-stamp">
                      <strong>{firm.name || "VOTRE ENTREPRISE"}</strong>
                      <span>{firm.address || "ADRESSE"}</span>
                      <span>{firm.contact || "CONTACT"}</span>
                    </div>
                    <div className="cr-number-box">CR N°{activeReport.meetingNumber}</div>
                  </div>
                  <div className="cr-project-row">
                    <div className="cr-project-box">
                      <strong>{activeProject.name || "NOM DU PROJET"}</strong>
                      <span>{activeProject.address || "ADRESSE DU CHANTIER"}</span>
                      {activeProject.details && <span>{activeProject.details}</span>}
                    </div>
                    <div className="cr-date-box">
                      <strong>DATE :</strong>
                      <span>{formatDateNumeric(activeReport.meetingDate)}</span>
                    </div>
                  </div>
                  <div className="cr-attendees">
                    <strong>PRESENTS :</strong> {activeReport.attendees || "A COMPLETER"}
                  </div>
                  <div className="cr-schedule">
                    <span>
                      DEBUT DE CHANTIER LE {activeProject.siteStart ? formatDateNumeric(activeProject.siteStart) : "A DEFINIR"}
                    </span>
                    <span>
                      POSE DE LA CUISINE{activeProject.kitchenInstall ? ` LE ${formatDateNumeric(activeProject.kitchenInstall)}` : ""}
                      {" — "}FIN DE CHANTIER {activeProject.siteEnd ? formatDateNumeric(activeProject.siteEnd) : "A DEFINIR"}
                    </span>
                  </div>
                  <div className="cr-warning">{FIXED_WARNING}</div>
                  <div className="cr-return">{FIXED_RETURN}</div>

                  <Table className="cr-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>N°</TableHead>
                        <TableHead>LOCALISATION</TableHead>
                        <TableHead>OBJET</TableHead>
                        <TableHead>CONCERNE</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeReport.points.length > 0 ? (
                        activeReport.points.map((point, index) => (
                          <TableRow key={point.id}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>{point.place}</TableCell>
                            <TableCell>{point.note}</TableCell>
                            <TableCell>{point.team}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="cr-empty-row">AUCUN POINT SAISI</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  {activeReport.generalNotes && (
                    <div className="cr-general-note">{activeReport.generalNotes}</div>
                  )}
                  <div className="cr-next-stamp">
                    <span>FIN DU CR- {activeReport.meetingNumber}</span>
                    <strong>
                      {nextMeetingSentence(activeReport)}
                    </strong>
                    <span>MERCI DE VALIDER VOTRE RECEPTION DE CR, IMPERATIVEMENT</span>
                  </div>
                  <div className="cr-legal-stamp">{FIXED_LEGAL}</div>
                </article>
              </section>
            </div>
          )}
        </>
      )}

      <Dialog open={launchOpen} onOpenChange={setLaunchOpen}>
        <DialogContent
          className="launch-dialog"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <div className="dialog-step-icon"><Play size={20} fill="currentColor" /></div>
            <DialogTitle>Lancer une réunion</DialogTitle>
            <DialogDescription>
              La date et le numéro du compte rendu sont automatiques.
            </DialogDescription>
          </DialogHeader>

          <div className="launch-dialog-body">
            {!creatingProject && data.projects.length > 0 ? (
              <>
                <div className="dialog-label-row">
                  <span>1 · Choisir le chantier</span>
                  <button onClick={() => {
                    setCreatingProject(true);
                    setLaunchProjectId("");
                    setNewProjectDraft(emptyProjectDraft());
                  }}>
                    <Plus size={14} /> Nouveau projet
                  </button>
                </div>
                <div className="launch-project-options">
                  {sortedProjects.map((project) => (
                    <button
                      key={project.id}
                      className={launchProjectId === project.id ? "is-selected" : ""}
                      onClick={() => selectLaunchProject(project.id)}
                    >
                      <Building2 size={17} />
                      <span><strong>{project.name}</strong><small>{project.address}</small></span>
                      {launchProjectId === project.id && <Check size={16} />}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="new-project-form">
                {data.projects.length > 0 && (
                  <button className="back-to-projects" onClick={() => setCreatingProject(false)}>
                    <ArrowLeft size={14} /> Choisir un projet existant
                  </button>
                )}
                <div className="dialog-label-row"><span>1 · Nouveau chantier</span></div>
                <div className="project-form-grid">
                  <label className="field field-full">
                    <span>Nom du projet</span>
                    <Input
                      value={newProjectDraft.name}
                      onChange={(event) => setNewProjectDraft({ ...newProjectDraft, name: event.target.value })}
                      placeholder="Ex. Rénovation appartement témoin"
                    />
                  </label>
                  <label className="field field-full">
                    <span>Adresse</span>
                    <Input
                      value={newProjectDraft.address}
                      onChange={(event) => setNewProjectDraft({ ...newProjectDraft, address: event.target.value })}
                      placeholder="Adresse du chantier"
                    />
                  </label>
                  <label className="field field-full">
                    <span>Détails fixes <i>facultatif</i></span>
                    <Input
                      value={newProjectDraft.details}
                      onChange={(event) => setNewProjectDraft({ ...newProjectDraft, details: event.target.value })}
                      placeholder="Étage, codes, lot…"
                    />
                  </label>
                  <label className="field">
                    <span>Début chantier</span>
                    <Input type="date" value={newProjectDraft.siteStart} onChange={(event) => setNewProjectDraft({ ...newProjectDraft, siteStart: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>Pose cuisine</span>
                    <Input type="date" value={newProjectDraft.kitchenInstall} onChange={(event) => setNewProjectDraft({ ...newProjectDraft, kitchenInstall: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>Fin chantier</span>
                    <Input type="date" value={newProjectDraft.siteEnd} onChange={(event) => setNewProjectDraft({ ...newProjectDraft, siteEnd: event.target.value })} />
                  </label>
                </div>
                <p className="one-time-hint"><Check size={14} /> Ces informations ne seront demandées qu’une seule fois.</p>
              </div>
            )}

            <div className="attendees-launch-field">
              <div className="dialog-label-row"><span>2 · Qui est présent aujourd’hui&nbsp;?</span></div>
              <label className="input-with-leading-icon">
                <Users size={17} />
                <Input
                  value={launchAttendees}
                  onChange={(event) => setLaunchAttendees(event.target.value)}
                  placeholder="Mme…, architecte, entreprises…"
                />
              </label>
              <p><CalendarDays size={13} /> {formatDateLong(localDate())} · CR n° automatique</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLaunchOpen(false)}>Annuler</Button>
            <Button className="start-now-button" onClick={startMeeting}>
              <Play size={17} fill="currentColor" /> Démarrer maintenant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dictationHelpOpen} onOpenChange={setDictationHelpOpen}>
        <DialogContent
          className="dictation-help-dialog"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <div className="dialog-step-icon dictation-icon"><Mic size={21} /></div>
            <DialogTitle>Activer la vraie dictée</DialogTitle>
            <DialogDescription>
              Le navigateur intégré bloque l’accès à la reconnaissance vocale.
              Sur iPhone, ouvrez le site dans Safari et vérifiez que Siri et
              Dictée sont activés dans les réglages.
            </DialogDescription>
          </DialogHeader>
          <div className="dictation-help-note">
            <strong>Une seule fois :</strong>
            <span>ouvrez dans Safari, touchez « Dicter », puis autorisez le micro.</span>
          </div>
          <DialogFooter className="dictation-help-actions">
            <Button
              variant="outline"
              onClick={() => {
                setDictationHelpOpen(false);
                window.requestAnimationFrame(() =>
                  noteInputRef.current?.focus({ preventScroll: true }),
                );
              }}
            >
              <Keyboard size={17} /> Micro du clavier
            </Button>
            <Button asChild>
              <a
                href={new URL("./", window.location.href).href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={17} /> Ouvrir dans Safari
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={firmSettingsOpen} onOpenChange={setFirmSettingsOpen}>
        <DialogContent
          className="project-edit-dialog"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Coordonnées du document</DialogTitle>
            <DialogDescription>
              Elles sont enregistrées dans votre espace privé Supabase et reprises
              automatiquement dans les PDF et fichiers Excel.
            </DialogDescription>
          </DialogHeader>
          <div className="project-form-grid">
            <label className="field field-full">
              <span>Nom affiché</span>
              <Input
                value={firmDraft.name}
                onChange={(event) => setFirmDraft({ ...firmDraft, name: event.target.value })}
                placeholder="Nom de l’entreprise"
              />
            </label>
            <label className="field field-full">
              <span>Adresse</span>
              <Input
                value={firmDraft.address}
                onChange={(event) => setFirmDraft({ ...firmDraft, address: event.target.value })}
                placeholder="Adresse postale"
              />
            </label>
            <label className="field field-full">
              <span>Contact</span>
              <Input
                value={firmDraft.contact}
                onChange={(event) => setFirmDraft({ ...firmDraft, contact: event.target.value })}
                placeholder="E-mail et téléphone"
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFirmSettingsOpen(false)}>
              Annuler
            </Button>
            <Button onClick={saveFirmSettings} disabled={firmSaving}>
              {firmSaving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingProjectId)} onOpenChange={(open) => !open && setEditingProjectId(null)}>
        <DialogContent
          className="project-edit-dialog"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Informations du chantier</DialogTitle>
            <DialogDescription>
              Elles seront reprises automatiquement dans chaque nouveau CR.
            </DialogDescription>
          </DialogHeader>
          <div className="project-form-grid">
            <label className="field field-full">
              <span>Nom du projet</span>
              <Input value={editProjectDraft.name} onChange={(event) => setEditProjectDraft({ ...editProjectDraft, name: event.target.value })} />
            </label>
            <label className="field field-full">
              <span>Adresse</span>
              <Input value={editProjectDraft.address} onChange={(event) => setEditProjectDraft({ ...editProjectDraft, address: event.target.value })} />
            </label>
            <label className="field field-full">
              <span>Détails fixes</span>
              <Input value={editProjectDraft.details} onChange={(event) => setEditProjectDraft({ ...editProjectDraft, details: event.target.value })} />
            </label>
            <label className="field">
              <span>Début chantier</span>
              <Input type="date" value={editProjectDraft.siteStart} onChange={(event) => setEditProjectDraft({ ...editProjectDraft, siteStart: event.target.value })} />
            </label>
            <label className="field">
              <span>Pose cuisine</span>
              <Input type="date" value={editProjectDraft.kitchenInstall} onChange={(event) => setEditProjectDraft({ ...editProjectDraft, kitchenInstall: event.target.value })} />
            </label>
            <label className="field">
              <span>Fin chantier</span>
              <Input type="date" value={editProjectDraft.siteEnd} onChange={(event) => setEditProjectDraft({ ...editProjectDraft, siteEnd: event.target.value })} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProjectId(null)}>Annuler</Button>
            <Button onClick={saveProject}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={placePickerOpen} onOpenChange={setPlacePickerOpen}>
        <SheetContent
          side="bottom"
          className="place-picker-sheet"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <SheetHeader>
            <SheetTitle>Choisir le lieu ou le sujet</SheetTitle>
            <SheetDescription>Les noms viennent de ses comptes rendus actuels.</SheetDescription>
          </SheetHeader>
          <label className="place-search">
            <Search size={17} />
            <Input value={placeQuery} onChange={(event) => setPlaceQuery(event.target.value)} placeholder="Rechercher ou écrire un lieu…" />
            {placeQuery.trim() && (
              <Button
                size="sm"
                onClick={() => {
                  setPlace(placeQuery.trim());
                  setPlacePickerOpen(false);
                  setPlaceQuery("");
                }}
              >Utiliser</Button>
            )}
          </label>
          <div className="place-picker-groups">
            <section>
              <h3>Pièces et zones</h3>
              <div>
                {ROOM_PLACES.filter((item) => item.toLocaleLowerCase("fr-FR").includes(placeQuery.toLocaleLowerCase("fr-FR"))).map((item) => (
                  <button key={item} className={place === item ? "is-selected" : ""} onClick={() => { setPlace(item); setPlacePickerOpen(false); setPlaceQuery(""); }}>
                    <MapPin size={14} /> {item}
                  </button>
                ))}
              </div>
            </section>
            <section>
              <h3>Lots et sujets</h3>
              <div>
                {TOPIC_PLACES.filter((item) => item.toLocaleLowerCase("fr-FR").includes(placeQuery.toLocaleLowerCase("fr-FR"))).map((item) => (
                  <button key={item} className={place === item ? "is-selected" : ""} onClick={() => { setPlace(item); setPlacePickerOpen(false); setPlaceQuery(""); }}>
                    <Zap size={14} /> {item}
                  </button>
                ))}
              </div>
            </section>
            {placeSuggestions.filter((item) => !ROOM_PLACES.includes(item) && !TOPIC_PLACES.includes(item)).length > 0 && (
              <section>
                <h3>Déjà utilisés sur ce chantier</h3>
                <div>
                  {placeSuggestions.filter((item) => !ROOM_PLACES.includes(item) && !TOPIC_PLACES.includes(item) && item.toLocaleLowerCase("fr-FR").includes(placeQuery.toLocaleLowerCase("fr-FR"))).map((item) => (
                    <button key={item} onClick={() => { setPlace(item); setPlacePickerOpen(false); setPlaceQuery(""); }}>{item}</button>
                  ))}
                </div>
              </section>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={archiveOpen} onOpenChange={setArchiveOpen}>
        <SheetContent
          side="right"
          className="archive-sheet"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <SheetHeader>
            <SheetTitle>Archives des réunions</SheetTitle>
            <SheetDescription>Tous les comptes rendus restent rééditables.</SheetDescription>
          </SheetHeader>
          <label className="archive-search">
            <Search size={16} />
            <Input value={archiveQuery} onChange={(event) => setArchiveQuery(event.target.value)} placeholder="Rechercher un chantier…" />
          </label>
          <div className="archive-list">
            {filteredArchive.map((report) => {
              const project = data.projects.find((item) => item.id === report.projectId);
              return (
                <article key={report.id}>
                  <button className="archive-open" onClick={() => openReport(report)}>
                    <span className={`report-status ${report.status}`}>
                      {report.status === "final" ? <Check size={14} /> : <Pencil size={14} />}
                    </span>
                    <div>
                      <strong>{project?.name ?? "Projet"}</strong>
                      <small>CR n°{report.meetingNumber} · {formatDateShort(report.meetingDate)} · {report.points.length} points</small>
                    </div>
                    <ChevronRight size={17} />
                  </button>
                  <Button variant="ghost" size="icon" aria-label="Supprimer" onClick={() => requestReportDeletion(report.id)}>
                    <Trash2 size={15} />
                  </Button>
                </article>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(editingPoint)} onOpenChange={(open) => !open && setEditingPoint(null)}>
        <DialogContent
          className="point-edit-dialog"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Modifier ce point</DialogTitle>
            <DialogDescription>Tout reste modifiable avant ou après la réunion.</DialogDescription>
          </DialogHeader>
          {editingPoint && (
            <div className="point-edit-fields">
              <label className="field">
                <span>Localisation</span>
                <Input value={editingPoint.place} onChange={(event) => setEditingPoint({ ...editingPoint, place: event.target.value })} />
              </label>
              <label className="field">
                <span>Objet</span>
                <Textarea value={editingPoint.note} onChange={(event) => setEditingPoint({ ...editingPoint, note: event.target.value })} />
              </label>
              <label className="field">
                <span>Concerné</span>
                <Input value={editingPoint.team} onChange={(event) => setEditingPoint({ ...editingPoint, team: event.target.value })} />
              </label>
            </div>
          )}
          <DialogFooter className="point-edit-footer">
            <Button variant="ghost" className="delete-point-button" onClick={() => editingPoint && requestPointDeletion(editingPoint.id)}>
              <Trash2 size={16} /> Supprimer
            </Button>
            <Button variant="outline" onClick={() => setEditingPoint(null)}>Annuler</Button>
            <Button onClick={saveEditedPoint}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deletePointId)} onOpenChange={(open) => !open && setDeletePointId(null)}>
        <AlertDialogContent
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce point&nbsp;?</AlertDialogTitle>
            <AlertDialogDescription>Il disparaîtra du compte rendu.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={deletePoint}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deleteReportId)} onOpenChange={(open) => !open && setDeleteReportId(null)}>
        <AlertDialogContent
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce compte rendu&nbsp;?</AlertDialogTitle>
            <AlertDialogDescription>Cette réunion sera supprimée de tous vos appareils.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={deleteReport}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
