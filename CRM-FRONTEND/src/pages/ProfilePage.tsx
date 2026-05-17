import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Camera,
  Mail,
  Phone,
  IdCard,
  Building2,
  Briefcase,
  UserCog,
  ShieldCheck,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { resolveAssetUrl } from '@/utils/assetUrl';
import { ProfilePhotoUploadDialog } from '@/components/users/ProfilePhotoUploadDialog';
import { ChangePasswordTab } from '@/components/users/ChangePasswordTab';
import { MySessionsTab } from '@/components/users/MySessionsTab';
import { MyActivityTab } from '@/components/users/MyActivityTab';
import { PrivacyTab } from '@/components/users/PrivacyTab';

type ProfileTab = 'identity' | 'password' | 'sessions' | 'activity' | 'privacy';

// Mirror UsersPage URL-tab sync (project_nav_url_h1_alignment.md).
const TAB_TO_SEGMENT: Record<ProfileTab, string> = {
  identity: 'identity',
  password: 'password',
  sessions: 'sessions',
  activity: 'activity',
  privacy: 'privacy',
};

const isProfileTab = (value: string | undefined): value is ProfileTab =>
  value === 'identity' ||
  value === 'password' ||
  value === 'sessions' ||
  value === 'activity' ||
  value === 'privacy';

export default function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const params = useParams<{ tab?: string }>();
  const initialTab: ProfileTab = isProfileTab(params.tab) ? params.tab : 'identity';
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);

  // Keep URL in sync with active tab on direct navigation.
  useEffect(() => {
    if (isProfileTab(params.tab) && params.tab !== activeTab) {
      setActiveTab(params.tab);
    }
  }, [params.tab, activeTab]);

  const handleTabChange = useCallback(
    (value: string) => {
      if (!isProfileTab(value)) {
        return;
      }
      setActiveTab(value);
      navigate(`/profile/${TAB_TO_SEGMENT[value]}`, { replace: true });
    },
    [navigate]
  );

  const initials = useMemo(() => {
    if (!user?.name) {
      return 'U';
    }
    return (
      user.name
        .split(' ')
        .map((n) => n[0] || '')
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'U'
    );
  }, [user?.name]);

  if (!user) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading profile…
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page title row — mobile stacks, desktop side-by-side */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">My Profile</h1>
          <p className="text-sm text-muted-foreground">
            Manage your personal information, password, sessions, and privacy.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4 sm:space-y-6">
        {/* Tab list — scrolls horizontally on phone instead of wrapping */}
        <div className="overflow-x-auto">
          <TabsList className="inline-flex w-max sm:w-auto">
            <TabsTrigger value="identity">Identity</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
          </TabsList>
        </div>

        {/* ============ Identity tab ============ */}
        <TabsContent value="identity" className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Photo</CardTitle>
              <CardDescription>JPEG, PNG, or WEBP up to 2 MB. Resized to 512×512.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
                <Avatar className="h-24 w-24 sm:h-28 sm:w-28">
                  <AvatarImage src={resolveAssetUrl(user.profilePhotoUrl)} alt={user.name} />
                  <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-center gap-2 sm:items-start">
                  <Button type="button" onClick={() => setPhotoDialogOpen(true)}>
                    <Camera className="mr-2 h-4 w-4" />
                    {user.profilePhotoUrl ? 'Change Photo' : 'Upload Photo'}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center sm:text-left">
                    Your photo appears on case timelines, audit logs, and the field-agent app.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Read-only. Contact your administrator to update these fields.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <ProfileField icon={UserCog} label="Full Name" value={user.name} />
                <ProfileField icon={IdCard} label="Username" value={user.username} caseSensitive />
                <ProfileField
                  icon={IdCard}
                  label="Employee ID"
                  value={user.employeeId}
                  caseSensitive
                />
                <ProfileField icon={Mail} label="Email" value={user.email ?? '—'} caseSensitive />
                <ProfileField icon={Phone} label="Phone" value={user.phone ?? '—'} caseSensitive />
                <ProfileField
                  icon={ShieldCheck}
                  label="Role"
                  value={user.roleName ?? user.role ?? '—'}
                />
                <ProfileField
                  icon={Building2}
                  label="Department"
                  value={user.departmentName ?? user.department ?? '—'}
                />
                <ProfileField
                  icon={Briefcase}
                  label="Designation"
                  value={user.designationName ?? user.designation ?? '—'}
                />
                {user.teamLeaderName && (
                  <ProfileField icon={UserCog} label="Team Leader" value={user.teamLeaderName} />
                )}
                {user.managerName && (
                  <ProfileField icon={UserCog} label="Manager" value={user.managerName} />
                )}
                <div className="sm:col-span-2 flex flex-wrap items-center gap-2 pt-2">
                  <Badge variant={user.isActive ? 'default' : 'secondary'}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ Password tab ============ */}
        <TabsContent value="password">
          <ChangePasswordTab userId={user.id} />
        </TabsContent>

        {/* ============ Sessions tab ============ */}
        <TabsContent value="sessions">
          <MySessionsTab userId={user.id} />
        </TabsContent>

        {/* ============ Activity tab ============ */}
        <TabsContent value="activity">
          <MyActivityTab userId={user.id} />
        </TabsContent>

        {/* ============ Privacy tab ============ */}
        <TabsContent value="privacy">
          <PrivacyTab userId={user.id} userName={user.name} />
        </TabsContent>
      </Tabs>

      <ProfilePhotoUploadDialog
        userId={user.id}
        userName={user.name}
        currentPhotoUrl={user.profilePhotoUrl ?? null}
        isSelf
        open={photoDialogOpen}
        onOpenChange={setPhotoDialogOpen}
      />
    </div>
  );
}

interface ProfileFieldProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  caseSensitive?: boolean;
}

function ProfileField({ icon: Icon, label, value, caseSensitive = false }: ProfileFieldProps) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd
          className={`text-sm font-medium text-foreground break-words ${caseSensitive ? 'case-sensitive' : ''}`}
        >
          {value}
        </dd>
      </div>
    </div>
  );
}
