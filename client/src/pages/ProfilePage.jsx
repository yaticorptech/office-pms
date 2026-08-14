import { useState } from 'react';
import { PageHeader } from '../components/PageHeader.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { Field, Input } from '../components/ui/Field.jsx';
import { MetaBadge } from '../components/ui/Badge.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { authApi } from '../services/resources.js';
import { ROLE_META, USER_STATUS_META } from '../utils/constants.js';
import { formatDate, typeLabel } from '../utils/format.js';

export const ProfilePage = () => {
  const { user, updateUser, signOut } = useAuth();
  const toast = useToast();

  const [profile, setProfile] = useState({
    name: user?.name || '',
    profilePhoto: user?.profilePhoto || '',
  });
  const [profileErrors, setProfileErrors] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [savingPassword, setSavingPassword] = useState(false);

  const onSaveProfile = async (event) => {
    event.preventDefault();

    if (profile.name.trim().length < 2) {
      setProfileErrors({ name: 'Name must be at least 2 characters' });
      return;
    }

    setSavingProfile(true);
    try {
      const response = await authApi.updateProfile({
        name: profile.name.trim(),
        profilePhoto: profile.profilePhoto.trim(),
      });
      updateUser(response.data);
      setProfileErrors({});
      toast.success('Profile updated successfully.');
    } catch (error) {
      setProfileErrors(error.fieldErrors || {});
      toast.error(error.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const onChangePassword = async (event) => {
    event.preventDefault();

    const errors = {};
    if (!passwords.currentPassword) errors.currentPassword = 'Enter your current password';
    if (passwords.newPassword.length < 8) errors.newPassword = 'Password must be at least 8 characters';
    if (passwords.newPassword !== passwords.confirm) errors.confirm = 'Passwords do not match';

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }

    setSavingPassword(true);
    try {
      await authApi.changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
      setPasswordErrors({});
      toast.success('Password changed successfully.');
    } catch (error) {
      setPasswordErrors(error.fieldErrors || {});
      toast.error(error.message);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <>
      <PageHeader title="My profile" description="Your account details and password." />

      <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardBody>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Avatar name={user?.name} src={user?.profilePhoto} size="lg" />
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-slate-900">{user?.name}</h2>
                <p className="truncate text-sm text-slate-500">{user?.email}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                    {typeLabel(user?.department)}
                  </span>
                  <MetaBadge map={ROLE_META} value={user?.role} />
                  <MetaBadge map={USER_STATUS_META} value={user?.status} />
                </div>
              </div>
              <div className="text-sm sm:text-right">
                <p className="text-xs text-slate-400">Member since</p>
                <p className="font-medium text-slate-700">{formatDate(user?.createdAt)}</p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Personal details" description="Update how your name appears." />
          <CardBody>
            <form onSubmit={onSaveProfile} noValidate className="space-y-4">
              <Field label="Full name" error={profileErrors.name} required>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    value={profile.name}
                    onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                  />
                )}
              </Field>

              <Field label="Email" hint="Contact an admin to change your email address.">
                {({ id }) => <Input id={id} value={user?.email || ''} disabled readOnly />}
              </Field>

              <Field label="Profile photo URL" error={profileErrors.profilePhoto}>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    type="url"
                    placeholder="https://…"
                    value={profile.profilePhoto}
                    onChange={(event) =>
                      setProfile({ ...profile, profilePhoto: event.target.value })
                    }
                  />
                )}
              </Field>

              <Button type="submit" loading={savingProfile}>
                Save changes
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Change password" description="Use at least 8 characters." />
          <CardBody>
            <form onSubmit={onChangePassword} noValidate className="space-y-4">
              <Field label="Current password" error={passwordErrors.currentPassword} required>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    type="password"
                    autoComplete="current-password"
                    value={passwords.currentPassword}
                    onChange={(event) =>
                      setPasswords({ ...passwords, currentPassword: event.target.value })
                    }
                  />
                )}
              </Field>

              <Field label="New password" error={passwordErrors.newPassword} required>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    type="password"
                    autoComplete="new-password"
                    value={passwords.newPassword}
                    onChange={(event) =>
                      setPasswords({ ...passwords, newPassword: event.target.value })
                    }
                  />
                )}
              </Field>

              <Field label="Confirm new password" error={passwordErrors.confirm} required>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    type="password"
                    autoComplete="new-password"
                    value={passwords.confirm}
                    onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })}
                  />
                )}
              </Field>

              <Button type="submit" loading={savingPassword}>
                Change password
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">Sign out</p>
              <p className="mt-0.5 text-sm text-slate-500">
                End your session on this device.
              </p>
            </div>
            <Button variant="secondary" onClick={signOut}>
              Logout
            </Button>
          </CardBody>
        </Card>
      </div>
    </>
  );
};
