"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EditUserDialog } from "@/components/admin/edit-user-dialog";
import { trpc } from "@/lib/trpc/client";
import { formatDate, getInitials } from "@/lib/utils";
import { emailSchema, phoneNumberOnlySchema } from "@/lib/validations";
import { toast } from "sonner";
import {
  Search,
  UserPlus,
  Users,
  FileText,
  CreditCard,
  CheckCircle,
  Star,
  Settings,
  Eye,
  EyeOff,
  Trash,
  Edit,
 
} from "lucide-react";

type UserRole = "CLIENT" | "PROVIDER" | "SUPER_ADMIN";

type ServiceType = { id: string; name: string; nameI18n?: Record<string, string> };

type UserData = {
  id: string;
  name: string | null;
  email: string;
  phone?: string | null;
  image: string | null;
  role: string;
  createdAt: Date;
  averageRating?: number | null;
  providerProfile: {
    id: string;
    supportedServices: ServiceType[];
  } | null;
  _count: {
    clientRequests: number;
    providerRequests: number;
    clientSubscriptions: number;
    receivedRatings: number;
  };
};

// Helper components to reduce nesting
function ServiceCheckboxItem({
  service,
  checked,
  onChange,
  idPrefix,
}: {
  service: ServiceType;
  checked: boolean;
  onChange: (checked: boolean) => void;
  idPrefix: string;
}): JSX.Element {
  const locale = useLocale();
  return (
    <div className="flex items-center gap-2 space-x-2">
      <Checkbox
        id={`${idPrefix}-${service.id}`}
        checked={checked}
        onCheckedChange={(c) => onChange(c === true)}
      />
      <label htmlFor={`${idPrefix}-${service.id}`} className="text-sm cursor-pointer flex-1">
        {service.nameI18n?.[locale] || service.name}
      </label>
    </div>
  );
}

function ProviderServiceBadges({ services }: { services: ServiceType[] }): JSX.Element {
  const t = useTranslations("admin.users");
  const locale = useLocale();
  if (services.length === 0) {
    return (
      <span className="text-xs text-muted-foreground italic">{t("servicesBadge.noServices")}</span>
    );
  }
  return (
    <>
      {services.map((service) => (
        <Badge key={service.id} variant="outline" className="text-xs">
          {service.nameI18n?.[locale] || service.name}
        </Badge>
      ))}
    </>
  );
}

function UserStatsClient({ count }: { count: UserData["_count"] }): JSX.Element {
  const t = useTranslations("admin.users");
  return (
    <>
      <div className="flex items-center gap-2 text-sm">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="font-medium">{count.clientRequests}</p>
          <p className="text-xs text-muted-foreground">{t("table.requests")}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <CreditCard className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="font-medium">{count.clientSubscriptions}</p>
          <p className="text-xs text-muted-foreground">{t("table.subscriptions")}</p>
        </div>
      </div>
    </>
  );
}

function UserStatsProvider({
  count,
  averageRating,
  onEditServices,
}: {
  count: UserData["_count"];
  averageRating?: number | null;
  onEditServices: () => void;
}): JSX.Element {
  const t = useTranslations("admin.users");
  return (
    <>
      <div className="flex items-center gap-2 text-sm">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="font-medium">{count.providerRequests}</p>
          <p className="text-xs text-muted-foreground">{t("table.requests")}</p>
        </div>
      </div>
      {averageRating !== null && averageRating !== undefined && (
        <div className="flex items-center gap-2 text-sm">
          <Star className="h-4 w-4 text-primary fill-primary" />
          <div>
            <p className="font-medium">{averageRating.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">
              {t("table.rating", { count: count.receivedRatings })}
            </p>
          </div>
        </div>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={onEditServices}
        className="flex items-center gap-1"
      >
        <Settings className="h-4 w-4" />
        {t("table.services")}
      </Button>
    </>
  );
}

function UserListItem({
  user,
  getRoleColor,
  onEditServices,
  onEdit,
  onDelete,
  onRestore,
  isDeleted,
}: {
  user: UserData;
  getRoleColor: (role: string) => string;
  onEditServices: () => void;
  onEdit: (user: {
    id: string;
    name: string | null;
    email: string;
    phone?: string | null;
  }) => void;
  onDelete: (userId: string) => void;
  onRestore?: (userId: string) => void;
  isDeleted?: boolean;
}): JSX.Element {
  const t = useTranslations("admin.users");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const providerServices = user.providerProfile?.supportedServices || [];

  const getRoleLabel = (role: string): string => {
    const roleMap: Record<string, string> = {
      CLIENT: tCommon("roles.CLIENT"),
      PROVIDER: tCommon("roles.PROVIDER"),
      SUPER_ADMIN: tCommon("roles.SUPER_ADMIN"),
    };
    return roleMap[role] || role;
  };


  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors gap-4">
      <div className="flex items-center gap-4">
        <Avatar className="h-12 w-12">
          <AvatarImage src={user.image || ""} className="object-cover" />
          <AvatarFallback className="text-lg">
            {getInitials(user.name || user.email)}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium text-lg">{user.name || "No name"}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          {user.phone && (
            <p dir="ltr" className="text-sm rtl:text-right text-muted-foreground mb-0">
              {user.phone}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge className={getRoleColor(user.role)}>{getRoleLabel(user.role)}</Badge>
            <span className="text-xs text-muted-foreground">
              {t("table.joined")} {formatDate(user.createdAt, locale)}
            </span>
          </div>
          {user.role === "PROVIDER" && (
            <div className="flex flex-wrap gap-1 mt-2">
              <ProviderServiceBadges services={providerServices} />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {user.role === "CLIENT" && <UserStatsClient count={user._count} />}
        {user.role === "PROVIDER" && (
          <UserStatsProvider
            count={user._count}
            averageRating={user.averageRating}
            onEditServices={onEditServices}
          />
        )}
        {isDeleted
          ? user.role !== "SUPER_ADMIN" &&
            onRestore && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm(`${t("dialog.buttons.update")} ${user.email}?`)) {
                    onRestore(user.id);
                  }
                }}
                className="flex items-center gap-1"
              >
                <CheckCircle className="h-4 w-4" />
                {t("dialog.buttons.update")}
              </Button>
            )
          : user.role !== "SUPER_ADMIN" && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(user)}
                  className="flex items-center gap-1"
                >
                  <Edit className="h-4 w-4" />
                  {t("dialog.edit.title")}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Delete user ${user.email}? This action cannot be undone.`)) {
                      onDelete(user.id);
                    }
                  }}
                  className="flex items-center gap-1"
                >
                  <Trash className="h-4 w-4" />
                  {t("dialog.delete.title")}
                </Button>
              </div>
            )}
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const t = useTranslations("admin.users");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"active" | "deleted">("active");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isServicesOpen, setIsServicesOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<{
    id: string;
    name: string | null;
    email: string;
    phone?: string | null;
  } | null>(null);
  const [selectedProviderServices, setSelectedProviderServices] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  // Form state for creating user
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    countryCode: "+20", // Default to Egypt
    phone: "",
    role: "CLIENT" as UserRole,
    supportedServiceIds: [] as string[],
  });

  const { data: users, isLoading } = trpc.admin.getUsers.useQuery({
    search: search || undefined,
    role: roleFilter === "all" ? undefined : (roleFilter as UserRole),
    showDeleted: activeTab === "deleted",
  });

  const { data: serviceTypes } = trpc.admin.getServiceTypes.useQuery();

  const utils = trpc.useUtils();

  const createUser = trpc.admin.createUser.useMutation({
    onSuccess: () => {
      utils.admin.getUsers.invalidate();
      setIsCreateOpen(false);
      setNewUser({
        name: "",
        email: "",
        password: "",
        countryCode: "+20",
        phone: "",
        role: "CLIENT",
        supportedServiceIds: [],
      });
      toast.success(t("dialog.toast.created"));
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateProviderServices = trpc.admin.updateProviderServices.useMutation({
    onSuccess: () => {
      utils.admin.getUsers.invalidate();
      setIsServicesOpen(false);
      setSelectedUserId(null);
      toast.success(t("dialog.toast.updated"));
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteUser = trpc.admin.deleteUser.useMutation({
    onSuccess: (data) => {
      utils.admin.getUsers.invalidate();
      toast.success(t("dialog.toast.deleted"));
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const restoreUser = trpc.admin.restoreUser.useMutation({
    onSuccess: (data) => {
      utils.admin.getUsers.invalidate();
      toast.success(t("dialog.toast.updated"));
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleCreateUser = () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast.error(t("dialog.toast.error"));
      return;
    }

    // Validate email using emailSchema
    const emailValidation = emailSchema.safeParse(newUser.email);
    if (!emailValidation.success) {
      toast.error(
        emailValidation.error.errors[0]?.message ||
          t("dialog.validation.invalidEmail") ||
          "Invalid email"
      );
      return;
    }

    // Validate phone number if provided
    let phone: string | undefined = undefined;
    if (newUser.phone) {
      const phoneValidation = phoneNumberOnlySchema.safeParse(newUser.phone);
      if (!phoneValidation.success) {
        toast.error(
          phoneValidation.error.errors[0]?.message ||
            t("dialog.validation.invalidPhone") ||
            "Invalid phone"
        );
        return;
      }
      phone = `${newUser.countryCode} ${newUser.phone}`;
    }

    const payload = {
      ...newUser,
      email: newUser.email.toLowerCase().trim(),
      phone,
    };
    createUser.mutate(payload as any);
  };

  const handleServiceToggle = (serviceId: string, checked: boolean) => {
    setNewUser((prev) => ({
      ...prev,
      supportedServiceIds: checked
        ? [...prev.supportedServiceIds, serviceId]
        : prev.supportedServiceIds.filter((id) => id !== serviceId),
    }));
  };

  const handleEditServiceToggle = (serviceId: string, checked: boolean) => {
    setSelectedProviderServices((prev) =>
      checked ? [...prev, serviceId] : prev.filter((id) => id !== serviceId)
    );
  };

  const handleSaveProviderServices = () => {
    if (selectedUserId) {
      updateProviderServices.mutate({
        userId: selectedUserId,
        serviceIds: selectedProviderServices,
      });
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "bg-destructive/15 text-destructive";
      case "PROVIDER":
        return "bg-primary/15 text-primary";
      case "CLIENT":
        return "bg-[#E0F840]/20 text-[#690DD4] dark:text-[#E0F840]";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  // Calculate stats
  const allUsers = (users?.users || []) as unknown as UserData[];
  const stats = {
    total: users?.total || 0,
    clients: allUsers.filter((u) => u.role === "CLIENT").length,
    providers: allUsers.filter((u) => u.role === "PROVIDER").length,
    admins: allUsers.filter((u) => u.role === "SUPER_ADMIN").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              {t("createUser")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("dialog.create.title")}</DialogTitle>
              <DialogDescription>{t("dialog.create.description")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("dialog.fields.name")} *</Label>
                <Input
                  id="name"
                  placeholder={t("dialog.fields.name")}
                  value={newUser.name}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t("dialog.fields.email")} *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser((prev) => ({ ...prev, email: e.target.value.toLowerCase().trim() }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t("dialog.fields.phone")}</Label>
                <div className="flex rtl:flex-row-reverse gap-2">
                  <Select
                    value={newUser.countryCode}
                    onValueChange={(value) =>
                      setNewUser((prev) => ({ ...prev, countryCode: value }))
                    }
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="+20">🇪🇬 +20</SelectItem>
                      <SelectItem value="+965">🇰🇼 +965</SelectItem>
                      <SelectItem value="+966">🇸🇦 +966</SelectItem>
                      <SelectItem value="+971">🇦🇪 +971</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="123456789"
                    value={newUser.phone}
                    onChange={(e) => {
                      const value = e.target.value.replaceAll(/\D/g, "");
                      setNewUser((prev) => ({ ...prev, phone: value }));
                    }}
                    pattern="[0-9]{7,15}"
                    title="Phone number must be 7-15 digits"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("dialog.fields.password")} *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t("dialog.fields.password")}
                    value={newUser.password}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute end-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">{t("dialog.fields.role")} *</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value: UserRole) =>
                    setNewUser((prev) => ({ ...prev, role: value, supportedServiceIds: [] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLIENT">{t("filters.client")}</SelectItem>
                    <SelectItem value="PROVIDER">{t("filters.provider")}</SelectItem>
                    <SelectItem value="SUPER_ADMIN">{t("filters.admin")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newUser.role === "PROVIDER" && serviceTypes && (
                <div className="space-y-2">
                  <Label>{t("dialog.fields.services")}</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    {t("dialog.fields.selectServices")}
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-2 border rounded-md p-3">
                    {serviceTypes.map((service: any) => (
                      <ServiceCheckboxItem
                        key={service.id}
                        service={service}
                        checked={newUser.supportedServiceIds.includes(service.id)}
                        onChange={(checked) => handleServiceToggle(service.id, checked)}
                        idPrefix="service"
                      />
                    ))}
                    {serviceTypes.length === 0 && (
                      <p className="text-sm text-muted-foreground">No services available</p>
                    )}
                  </div>
                </div>
              )}

              <Button className="w-full" onClick={handleCreateUser} disabled={createUser.isPending}>
                {createUser.isPending ? t("dialog.buttons.creating") : t("dialog.buttons.create")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("filters.allRoles")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("filters.client")}</CardTitle>
            <Users className="h-4 w-4 text-[#690DD4] dark:text-[#E0F840]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#690DD4] dark:text-[#E0F840]">{stats.clients}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("filters.provider")}</CardTitle>
            <Star className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.providers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("filters.admin")}</CardTitle>
            <CheckCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.admins}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ps-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("filters.role")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filters.allRoles")}</SelectItem>
                <SelectItem value="CLIENT">{t("filters.client")}</SelectItem>
                <SelectItem value="PROVIDER">{t("filters.provider")}</SelectItem>
                <SelectItem value="SUPER_ADMIN">{t("filters.admin")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>{t("table.user")}</CardTitle>
          <CardDescription>
            {users?.total || 0}{" "}
            {Number(users?.total) > 0 ? t("table.allUsers") : t("table.noUsers")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as "active" | "deleted")}
          >
            <TabsList className="mb-4">
              <TabsTrigger value="active">{t("tabs.allUsers")}</TabsTrigger>
              <TabsTrigger value="deleted">{t("table.noUsers")}</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4">
              {isLoading && (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              )}
              {!isLoading && users?.users.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">{t("table.noUsers")}</div>
              )}
              {!isLoading && (users?.users.length ?? 0) > 0 && (
                <div className="space-y-4">
                  {(users?.users as unknown as UserData[]).map((user) => (
                    <UserListItem
                      key={user.id}
                      user={user}
                      getRoleColor={getRoleColor}
                      onEditServices={() => {
                        setSelectedUserId(user.id);
                        const serviceIds =
                          user.providerProfile?.supportedServices?.map((s) => s.id) || [];
                        setSelectedProviderServices(serviceIds);
                        setIsServicesOpen(true);
                      }}
                      onEdit={(user) => {
                        setEditingUser(user);
                        setIsEditOpen(true);
                      }}
                      onDelete={(userId) => {
                        deleteUser.mutate({ userId });
                      }}
                      isDeleted={false}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="deleted" className="space-y-4">
              {isLoading && (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              )}
              {!isLoading && users?.users.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">{t("table.noUsers")}</div>
              )}
              {!isLoading && (users?.users.length ?? 0) > 0 && (
                <div className="space-y-4">
                  {(users?.users as unknown as UserData[]).map((user) => (
                    <UserListItem
                      key={user.id}
                      user={user}
                      getRoleColor={getRoleColor}
                      onEditServices={() => {
                        setSelectedUserId(user.id);
                        const serviceIds =
                          user.providerProfile?.supportedServices?.map((s) => s.id) || [];
                        setSelectedProviderServices(serviceIds);
                        setIsServicesOpen(true);
                      }}
                      onEdit={(user) => {
                        setEditingUser(user);
                        setIsEditOpen(true);
                      }}
                      onDelete={(userId) => {
                        deleteUser.mutate({ userId });
                      }}
                      onRestore={(userId) => {
                        restoreUser.mutate({ userId });
                      }}
                      isDeleted={true}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Edit Provider Services Dialog */}
      <Dialog open={isServicesOpen} onOpenChange={setIsServicesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dialog.fields.services")}</DialogTitle>
            <DialogDescription>{t("dialog.fields.selectServices")}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="max-h-64 overflow-y-auto space-y-2 border rounded-md p-3">
              {serviceTypes?.map((service: any) => (
                <ServiceCheckboxItem
                  key={service.id}
                  service={service}
                  checked={selectedProviderServices.includes(service.id)}
                  onChange={(checked) => handleEditServiceToggle(service.id, checked)}
                  idPrefix="edit-service"
                />
              ))}
              {(!serviceTypes || serviceTypes.length === 0) && (
                <p className="text-sm text-muted-foreground">No services available</p>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setIsServicesOpen(false)}>
                {t("dialog.buttons.cancel")}
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveProviderServices}
                disabled={updateProviderServices.isPending}
              >
                {updateProviderServices.isPending
                  ? t("dialog.buttons.updating")
                  : t("dialog.buttons.update")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <EditUserDialog
        user={editingUser}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSuccess={() => {
          utils.admin.getUsers.invalidate();
        }}
      />
    </div>
  );
}
