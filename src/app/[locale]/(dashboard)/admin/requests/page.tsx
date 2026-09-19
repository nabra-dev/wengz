"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { AssignProviderDialog } from "@/components/admin/assign-provider-dialog";

type Request = {
  id: string;
  title: string;
  status: string;
  priority: number;
  createdAt: string | Date;
  client: { id: string; name: string | null; email: string };
  provider: { id: string; name: string | null; email: string } | null;
  serviceType: { id: string; name: string };
  creditCost: number;
};

export default function AdminRequestsPage() {
  const t = useTranslations("admin.requests");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);

  const { data, isLoading, refetch } = trpc.admin.getAllRequests.useQuery();
  const deleteRequest = trpc.admin.deleteRequest.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const requests: any[] = data?.requests || [];

  const filteredRequests = requests.filter((request: any) => {
    const matchesStatus =
      statusFilter === "all" ||
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
    pending: requests.filter((r: any) => r.status === "PENDING").length,
    inProgress: requests.filter((r: any) => r.status === "IN_PROGRESS").length,
    completed: requests.filter((r: any) => r.status === "COMPLETED").length,
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
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
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
            <CheckCircle className="h-4 w-4 text-primary" />
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
              {filteredRequests.map((request: any) => (
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
                      {request.status !== "COMPLETED" && request.status !== "CANCELLED" && (
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
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (
                            confirm(
                              `${t("actions.delete")} "${request.title}"? This action cannot be undone.`
                            )
                          ) {
                            deleteRequest.mutate({ requestId: request.id });
                          }
                        }}
                        disabled={deleteRequest.isPending}
                        className="flex items-center gap-1"
                      >
                        <Trash className="h-4 w-4" />
                        {t("actions.delete")}
                      </Button>
                    </>
                  }
                />
              ))}
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
    </div>
  );
}
