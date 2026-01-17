export type ModelOption = {
  id: string;
  model_id_for_api_call: string;
  name: string;
  type: string;
  provider_name?: string;
  is_active: boolean;
};

export const isChatModelOption = (model: ModelOption) => {
  const id = model.model_id_for_api_call.toLowerCase();
  const name = model.name.toLowerCase();

  let provider = (model.provider_name || '').toLowerCase();
  if (!provider) {
    if (
      id.startsWith('gpt-') ||
      id.startsWith('o1') ||
      id.startsWith('o3') ||
      id.startsWith('o4') ||
      id.startsWith('chatgpt')
    ) {
      provider = 'openai';
    } else if (
      id.startsWith('gemini') ||
      id.startsWith('gemma') ||
      id.startsWith('models/gemini')
    ) {
      provider = 'google';
    } else if (id.startsWith('claude')) {
      provider = 'anthropic';
    } else if (id.startsWith('grok')) {
      provider = 'xai';
    } else if (id.startsWith('deepseek')) {
      provider = 'deepseek';
    }
  }

  if (id.includes('embedding') || model.type === 'embedding') return false;
  if (name.includes('embedding') || name.includes('\uc784\ubca0\ub529')) return false;

  if (
    provider.includes('openai') ||
    id.startsWith('gpt-') ||
    id.startsWith('o1') ||
    id.startsWith('o3') ||
    id.startsWith('o4') ||
    id.startsWith('chatgpt')
  ) {
    const allowedOpenAI = new Set([
      'gpt-5.2-pro',
      'gpt-5.2',
      'gpt-5.1',
      'gpt-5',
      'o3-pro',
      'o3',
      'o1-pro',
      'o1',
      'gpt-4.1',
      'gpt-4o',
      'gpt-4-turbo-preview',
      'chatgpt-4o-latest',
      'gpt-5-mini',
      'gpt-5-nano',
      'gpt-4.1-mini',
      'gpt-4o-mini',
      'o3-mini',
      'o4-mini',
      'gpt-realtime',
      'gpt-realtime-mini',
    ]);
    const cleanId = id.replace('models/', '');
    const isAllowed = allowedOpenAI.has(cleanId);
    if (!isAllowed) return false;
  }

  if (provider.includes('anthropic') || id.startsWith('claude')) {
    const allowedAnthropic = new Set([
      'claude-opus-4-5-20251101',
      'claude-sonnet-4-5-20250929',
      'claude-haiku-4-5-20251001',
      'claude-3-5-sonnet-latest',
      'claude-3-5-opus-latest',
      'claude-3-5-haiku-latest',
      'claude-opus-4-1-20250805',
      'claude-sonnet-4-20250514',
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
    ]);
    const cleanId = id.replace('models/', '');
    const isAllowed = allowedAnthropic.has(cleanId);
    if (!isAllowed) return false;
  }

  if (provider.includes('google') || id.includes('gemini') || id.includes('gemma')) {
    const allowedGoogle = new Set([
      'gemini-3-pro',
      'gemini-3-flash',
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-robotics-er-1.5-preview',
      'gemma-3-27b-it',
    ]);
    const cleanId = id.replace('models/', '');
    const isAllowed = allowedGoogle.has(cleanId);
    if (!isAllowed) return false;
  }

  return true;
};

export const groupModelsByProvider = (models: ModelOption[]) => {
  const sorted = [...models].sort((a, b) => a.name.localeCompare(b.name));
  const grouped = sorted.reduce(
    (acc, model) => {
      const provider = model.provider_name || 'Unknown';
      if (!acc[provider]) acc[provider] = [];
      acc[provider].push(model);
      return acc;
    },
    {} as Record<string, ModelOption[]>,
  );

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([provider, providerModels]) => ({
      provider,
      models: providerModels,
    }));
};

export const pickPreferredModelId = (
  models: ModelOption[],
  preferredIds: string[],
) => {
  if (!models.length) return '';
  const available = new Set(models.map((model) => model.model_id_for_api_call));
  for (const preferredId of preferredIds) {
    if (available.has(preferredId)) return preferredId;
    const prefixed = preferredId.startsWith('models/')
      ? preferredId
      : `models/${preferredId}`;
    if (available.has(prefixed)) return prefixed;
  }
  return models[0]?.model_id_for_api_call || '';
};
