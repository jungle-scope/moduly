import { redirect } from 'next/navigation';

export default function SettingsProviderRedirect() {
  redirect('/dashboard/settings');
}
