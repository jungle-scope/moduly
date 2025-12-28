import { LLMProviderRegisterButton } from '../features/settings/components/LLMProviderRegisterButton';

export default function SettingsPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">settings</h1>
        <LLMProviderRegisterButton />
      </div>
    </div>
  );
}
