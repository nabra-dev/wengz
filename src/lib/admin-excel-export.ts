import ExcelJS from "exceljs";
import { resolveLocalizedText } from "@/lib/i18n";

export type ExportLocale = "en" | "ar";

export const EXCEL_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const EXPORT_MAX_ROWS = 5000;

const LABELS = {
  en: {
    yes: "Yes",
    no: "No",
    usersSheet: "Users",
    requestsSheet: "Requests",
    userColumns: {
      name: "Name",
      email: "Email",
      phone: "Phone",
      role: "Role",
      approvalStatus: "Approval status",
      active: "Active",
      clientRequests: "Client requests",
      providerRequests: "Creator requests",
      subscriptions: "Subscriptions",
      rating: "Average rating",
      services: "Services",
      joined: "Joined",
      rejectionReason: "Rejection reason",
    },
    requestColumns: {
      id: "Request ID",
      title: "Title",
      status: "Status",
      serviceType: "Service type",
      clientName: "Client name",
      clientEmail: "Client email",
      providerName: "Creator name",
      providerEmail: "Creator email",
      creditCost: "Credits",
      needsManualApproval: "Needs manual approval",
      createdAt: "Created at",
      updatedAt: "Updated at",
      deliveredAt: "Delivered at",
      completedAt: "Completed at",
    },
    roles: {
      SUPER_ADMIN: "Super Admin",
      PROJECT_MANAGER: "Project Manager",
      FINANCE_MANAGER: "Finance Manager",
      PROVIDER: "Creator",
      CLIENT: "Client",
    },
    approval: {
      PENDING: "Pending",
      APPROVED: "Approved",
      REJECTED: "Rejected",
    },
    statuses: {
      PENDING: "Pending",
      IN_PROGRESS: "In Progress",
      DELIVERED: "Delivered",
      REVISION_REQUESTED: "Revision Requested",
      COMPLETED: "Completed",
      CANCELLED: "Cancelled",
    },
  },
  ar: {
    yes: "نعم",
    no: "لا",
    usersSheet: "المستخدمون",
    requestsSheet: "الطلبات",
    userColumns: {
      name: "الاسم",
      email: "البريد الإلكتروني",
      phone: "الهاتف",
      role: "الدور",
      approvalStatus: "حالة الموافقة",
      active: "نشط",
      clientRequests: "طلبات العميل",
      providerRequests: "طلبات المبدع",
      subscriptions: "الاشتراكات",
      rating: "متوسط التقييم",
      services: "الخدمات",
      joined: "تاريخ الانضمام",
      rejectionReason: "سبب الرفض",
    },
    requestColumns: {
      id: "معرّف الطلب",
      title: "العنوان",
      status: "الحالة",
      serviceType: "نوع الخدمة",
      clientName: "اسم العميل",
      clientEmail: "بريد العميل",
      providerName: "اسم المبدع",
      providerEmail: "بريد المبدع",
      creditCost: "الرصيد",
      needsManualApproval: "يحتاج موافقة يدوية",
      createdAt: "تاريخ الإنشاء",
      updatedAt: "تاريخ التحديث",
      deliveredAt: "تاريخ التسليم",
      completedAt: "تاريخ الإكمال",
    },
    roles: {
      SUPER_ADMIN: "مدير النظام",
      PROJECT_MANAGER: "مدير المشاريع",
      FINANCE_MANAGER: "المدير المالي",
      PROVIDER: "مبدع",
      CLIENT: "عميل",
    },
    approval: {
      PENDING: "قيد الانتظار",
      APPROVED: "مقبول",
      REJECTED: "مرفوض",
    },
    statuses: {
      PENDING: "قيد الانتظار",
      IN_PROGRESS: "قيد التنفيذ",
      DELIVERED: "تم التسليم",
      REVISION_REQUESTED: "طُلبت مراجعة",
      COMPLETED: "مكتمل",
      CANCELLED: "ملغى",
    },
  },
} as const;

export function normalizeExportLocale(locale: string | null | undefined): ExportLocale {
  return locale === "ar" ? "ar" : "en";
}

function formatDateTime(value: Date | string | null | undefined, locale: ExportLocale): string {
  if (!value) return "";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function workbookToBase64(workbook: ExcelJS.Workbook): Promise<string> {
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer).toString("base64");
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.alignment = { vertical: "middle", wrapText: true };
}

function autoWidth(sheet: ExcelJS.Worksheet, min = 12, max = 40) {
  sheet.columns.forEach((column) => {
    let longest = min;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > longest) longest = len;
    });
    column.width = Math.min(max, Math.max(min, longest + 2));
  });
}

function exportFileName(prefix: string, locale: ExportLocale): string {
  const day = new Date().toISOString().slice(0, 10);
  return `${prefix}-${locale}-${day}.xlsx`;
}

export type ExportUserRow = {
  name: string | null;
  email: string;
  phone?: string | null;
  role: string;
  approvalStatus?: string | null;
  deletedAt?: Date | string | null;
  createdAt: Date | string;
  rejectionReason?: string | null;
  averageRating?: number | null;
  providerProfile?: {
    supportedServices?: { name: string; nameI18n?: Record<string, string> | null }[];
  } | null;
  _count?: {
    clientRequests?: number;
    providerRequests?: number;
    clientSubscriptions?: number;
  };
};

export async function buildUsersExcel(params: {
  users: ExportUserRow[];
  locale: ExportLocale;
}): Promise<{ fileName: string; base64: string; contentType: string; rowCount: number }> {
  const { locale } = params;
  const t = LABELS[locale];
  const users = params.users.slice(0, EXPORT_MAX_ROWS);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Wengz";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(t.usersSheet);
  const cols = t.userColumns;
  sheet.addRow([
    cols.name,
    cols.email,
    cols.phone,
    cols.role,
    cols.approvalStatus,
    cols.active,
    cols.clientRequests,
    cols.providerRequests,
    cols.subscriptions,
    cols.rating,
    cols.services,
    cols.joined,
    cols.rejectionReason,
  ]);
  styleHeader(sheet.getRow(1));

  for (const user of users) {
    const services = (user.providerProfile?.supportedServices ?? [])
      .map((s) => resolveLocalizedText(s.nameI18n, locale, s.name))
      .filter(Boolean)
      .join(", ");

    sheet.addRow([
      user.name ?? "",
      user.email,
      user.phone ?? "",
      t.roles[user.role as keyof typeof t.roles] ?? user.role,
      t.approval[(user.approvalStatus ?? "APPROVED") as keyof typeof t.approval] ??
        user.approvalStatus ??
        "",
      user.deletedAt ? t.no : t.yes,
      user._count?.clientRequests ?? 0,
      user._count?.providerRequests ?? 0,
      user._count?.clientSubscriptions ?? 0,
      user.averageRating != null ? Number(user.averageRating.toFixed(2)) : "",
      services,
      formatDateTime(user.createdAt, locale),
      user.rejectionReason ?? "",
    ]);
  }

  autoWidth(sheet);
  if (locale === "ar") {
    sheet.views = [{ rightToLeft: true }];
  }

  return {
    fileName: exportFileName("users", locale),
    base64: await workbookToBase64(workbook),
    contentType: EXCEL_MIME,
    rowCount: users.length,
  };
}

export type ExportRequestRow = {
  id: string;
  title: string;
  status: string;
  creditCost?: number | null;
  needsManualApproval?: boolean | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  deliveredAt?: Date | string | null;
  completedAt?: Date | string | null;
  client?: { name: string | null; email: string } | null;
  provider?: { name: string | null; email: string } | null;
  serviceType?: {
    name: string;
    nameI18n?: Record<string, string> | null;
  } | null;
};

export async function buildRequestsExcel(params: {
  requests: ExportRequestRow[];
  locale: ExportLocale;
}): Promise<{ fileName: string; base64: string; contentType: string; rowCount: number }> {
  const { locale } = params;
  const t = LABELS[locale];
  const requests = params.requests.slice(0, EXPORT_MAX_ROWS);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Wengz";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(t.requestsSheet);
  const cols = t.requestColumns;
  sheet.addRow([
    cols.id,
    cols.title,
    cols.status,
    cols.serviceType,
    cols.clientName,
    cols.clientEmail,
    cols.providerName,
    cols.providerEmail,
    cols.creditCost,
    cols.needsManualApproval,
    cols.createdAt,
    cols.updatedAt,
    cols.deliveredAt,
    cols.completedAt,
  ]);
  styleHeader(sheet.getRow(1));

  for (const request of requests) {
    sheet.addRow([
      request.id,
      request.title,
      t.statuses[request.status as keyof typeof t.statuses] ?? request.status,
      resolveLocalizedText(request.serviceType?.nameI18n, locale, request.serviceType?.name ?? ""),
      request.client?.name ?? "",
      request.client?.email ?? "",
      request.provider?.name ?? "",
      request.provider?.email ?? "",
      request.creditCost ?? 0,
      request.needsManualApproval ? t.yes : t.no,
      formatDateTime(request.createdAt, locale),
      formatDateTime(request.updatedAt, locale),
      formatDateTime(request.deliveredAt, locale),
      formatDateTime(request.completedAt, locale),
    ]);
  }

  autoWidth(sheet, 12, 48);
  if (locale === "ar") {
    sheet.views = [{ rightToLeft: true }];
  }

  return {
    fileName: exportFileName("requests", locale),
    base64: await workbookToBase64(workbook),
    contentType: EXCEL_MIME,
    rowCount: requests.length,
  };
}

export { EXPORT_MAX_ROWS };
