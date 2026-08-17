export type AIProviderConfig = {
  useOpenAI: boolean;
  openaiApiKey: string;
  lovableApiKey: string;
};

/** Reject common mis-pasted keys before calling api.openai.com. */
export function assertValidOpenAIKey(key: string): void {
  const trimmed = key.trim();
  if (trimmed.startsWith('sk-or-v1')) {
    throw new Error(
      'OPENAI_API_KEY looks like an OpenRouter key (sk-or-v1…), not an OpenAI key. Create a key at https://platform.openai.com/account/api-keys and update the Supabase OPENAI_API_KEY secret.',
    );
  }
  if (!/^sk-(proj-|svcacct-|[a-zA-Z0-9])/i.test(trimmed)) {
    throw new Error(
      'OPENAI_API_KEY does not look like a valid OpenAI key (expected sk-… or sk-proj-…). Update the Supabase OPENAI_API_KEY secret with a key from https://platform.openai.com/account/api-keys.',
    );
  }
}

export function resolveAIProvider(
  openaiApiKey: string | undefined,
  lovableApiKey: string | undefined,
): AIProviderConfig {
  const trimmedOpenAI = openaiApiKey?.trim() ?? '';
  const useOpenAI = Boolean(
    trimmedOpenAI && !trimmedOpenAI.toLowerCase().includes('waiting_for_token'),
  );

  if (useOpenAI) {
    assertValidOpenAIKey(trimmedOpenAI);
  }

  const lovable = lovableApiKey?.trim() ?? '';
  if (!useOpenAI && !lovable) {
    throw new Error(
      'LOVABLE_API_KEY is not configured (required when OPENAI_API_KEY is not set)',
    );
  }

  return {
    useOpenAI,
    openaiApiKey: trimmedOpenAI,
    lovableApiKey: lovable,
  };
}
