"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RequestCard } from "@/components/requests/request-card";
import { EmptyRequestsState } from "@/components/requests/empty-requests-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Search,
  Eye,
  Clock,
  CheckCircle,
  Loader2,
  PlayCircle,
  UserPlus,
  Trash,
  Plus,
  Download,
  RotateCcw,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { AssignProviderDialog } from "@/components/admin/assign-provider-dialog";
import { downloadBase64File } from "@/lib/download-base64-file";
import { showError } from "@/lib/error-handler";

type Request = {
  id: string;
  title: string;
  status: string;
  createdAt: string | Date;
  deletedAt?: string | Date | null;
  client: { id: string; name: string | null; email: string };
  provider: { id: string; name: string | null; email: string } | null;
  serviceType: { id: string; name: string };
  creditCost: number;
};

type RequestStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "DELIVERED"
  | "REVISION_REQUESTED"
  | "COMPLETED"
  | "CANCELLED";

export default function AdminRequestsPage() {
  const t = useTranslations("admin.requests");
  const locale = useLocale();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; title: string } | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<{ id: string; title: string } | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);

  const deletedMode = statusFilter === "deleted" ? ("only" as const) : ("exclude" as const);
  const statusQuery =
    statusFilter !== "all" && statusFilter !== "needsManualApproval" && statusFilter !== "deleted"
      ? (statusFilter as RequestStatus)
      : undefined;

  const { data, isLoading, refetch } = trpc.admin.getAllRequests.useQuery({
    status: statusQuery,
    deleted: deletedMode,
    limit: 100,
  });
  const deleteRequest = trpc.admin.deleteRequest.useMutation({
    onSuccess: () => {
      setConfirmDelete(null);
      refetch();
    },
  });
  const restoreRequest = trpc.admin.restoreRequest.useMutation({
    onSuccess: () => {
      setConfirmRestore(null);
      refetch();
      toast.success(t("actions.restore"));
    },
    onError: (error) => {
      showError(error, t("actions.restore"));
    },
  });
  const exportRequests = trpc.admin.exportRequests.useMutation({
    onSuccess: (result) => {
      downloadBase64File({
        base64: result.base64,
        fileName: result.fileName,
        contentType: result.contentType,
      });
      toast.success(t("export.success", { count: result.rowCount }));
    },
    onError: (error) => {
      showError(error, t("export.error"));
    },
  });

  const requests: any[] = data?.requests || [];

  const filteredRequests = requests.filter((request: any) => {
    const matchesStatus =
      statusFilter === "all" ||
      statusFilter === "deleted" ||
      (statusFilter === "needsManualApproval"
        ? request.needsManualApproval === true
        : request.status === statusFilter);
    const matchesSearch =
      searchQuery === "" ||
      request.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.client.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.client.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const stats = {
    total: requests.length,
    pending: requests.filter((r: any) => r.status === "PENDING" && !r.deletedAt).length,
    inProgress: requests.filter((r: any) => r.status === "IN_PROGRESS" && !r.deletedAt).length,
    completed: requests.filter((r: any) => r.status === "COMPLETED" && !r.deletedAt).length,
  };

  const handleAssignClick = (request: any) => {
    setSelectedRequest(request);
    setAssignDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            disabled={exportRequests.isPending}
            onClick={() =>
              exportRequests.mutate({
                search: searchQuery || undefined,
                status: statusQuery,
                deleted: deletedMode,
                needsManualApproval: statusFilter === "needsManualApproval" ? true : undefined,
                locale: locale === "ar" ? "ar" : "en",
              })
            }
          >
            {exportRequests.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exportRequests.isPending ? t("actions.exporting") : t("actions.exportExcel")}
          </Button>
          <Button asChild className="gap-2">
            <Link href="/admin/requests/new">
              <Plus className="h-4 w-4" />
              {t("actions.createRequest")}
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("filters.allStatuses")}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("filters.pending")}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("filters.inProgress")}</CardTitle>
            <PlayCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("filters.completed")}</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t("filters.status")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={t("search")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full ps-10 pe-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("filters.status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filters.allStatuses")}</SelectItem>
                <SelectItem value="PENDING">{t("filters.pending")}</SelectItem>
                <SelectItem value="IN_PROGRESS">{t("filters.inProgress")}</SelectItem>
                <SelectItem value="DELIVERED">{t("filters.delivered")}</SelectItem>
                <SelectItem value="REVISION_REQUESTED">{t("filters.revisionRequested")}</SelectItem>
                <SelectItem value="COMPLETED">{t("filters.completed")}</SelectItem>
                <SelectItem value="CANCELLED">{t("filters.cancelled")}</SelectItem>
                <SelectItem value="needsManualApproval">
                  {t("filters.needsManualApproval")}
                </SelectItem>
                <SelectItem value="deleted">{t("filters.deleted")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Requests List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t("title")} ({filteredRequests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredRequests.length === 0 ? (
            <EmptyRequestsState
              title={t("table.noRequests")}
              description={
                searchQuery || statusFilter !== "all"
                  ? t("table.tryAdjusting")
                  : t("table.noRequests")
              }
            />
          ) : (
            <div className="space-y-4">
              {filteredRequests.map((request: any) => {
                const isDeleted = Boolean(request.deletedAt);
                return (
                  <RequestCard
                    key={request.id}
                    id={request.id}
                    title={request.title}
                    status={request.status}
                    creditCost={request.creditCost || 0}
                    createdAt={request.createdAt}
                    serviceType={request.serviceType}
                    client={request.client}
                    provider={request.provider}
                    needsManualApproval={request.needsManualApproval === true}
                    href={`/admin/requests/${request.id}`}
                    variant="compact"
                    actions={
                      <>
                        {!isDeleted &&
                          request.status !== "COMPLETED" &&
                          request.status !== "CANCELLED" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAssignClick(request)}
                              className="flex items-center gap-1"
                            >
                              <UserPlus className="h-4 w-4" />
                              {t("actions.assignProvider")}
                            </Button>
                          )}
                        <Link href={`/admin/requests/${request.id}`}>
                          <Button variant="ghost" size="sm" className="flex items-center gap-1">
                            <Eye className="h-4 w-4" />
                            {t("actions.view")}
                          </Button>
                        </Link>
                        {isDeleted ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setConfirmRestore({ id: request.id, title: request.title })
                            }
                            disabled={restoreRequest.isPending}
                            className="flex items-center gap-1"
                          >
                            <RotateCcw className="h-4 w-4" />
                            {t("actions.restore")}
                          </Button>
                        ) : (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              setConfirmDelete({ id: request.id, title: request.title })
                            }
                            disabled={deleteRequest.isPending}
                            className="flex items-center gap-1"
                          >
                            <Trash className="h-4 w-4" />
                            {t("actions.delete")}
                          </Button>
                        )}
                      </>
                    }
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign Provider Dialog */}
      {selectedRequest && (
        <AssignProviderDialog
          request={selectedRequest}
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          onAssigned={() => refetch()}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
        title={t("actions.delete")}
        description={
          confirmDelete ? t("confirmations.delete", { title: confirmDelete.title }) : undefined
        }
        confirmLabel={t("actions.delete")}
        variant="destructive"
        loading={deleteRequest.isPending}
        onConfirm={() => {
          if (confirmDelete) {
            deleteRequest.mutate({ requestId: confirmDelete.id });
          }
        }}
      />

      <ConfirmDialog
        open={!!confirmRestore}
        onOpenChange={(open) => {
          if (!open) setConfirmRestore(null);
        }}
        title={t("actions.restore")}
        description={
          confirmRestore ? t("confirmations.restore", { title: confirmRestore.title }) : undefined
        }
        confirmLabel={t("actions.restore")}
        loading={restoreRequest.isPending}
        onConfirm={() => {
          if (confirmRestore) {
            restoreRequest.mutate({ requestId: confirmRestore.id });
          }
        }}
      />
    </div>
  );
}
