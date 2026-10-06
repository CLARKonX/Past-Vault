let pastVaultSupabaseClient = null;

function getSupabaseClient() {
  if (pastVaultSupabaseClient) return pastVaultSupabaseClient;

  const config = window.PASTVAULT_SUPABASE_CONFIG;
  if (!window.supabase || !config || !config.url || !config.publishableKey ||
      config.url.includes("PASTE_") || config.publishableKey.includes("PASTE_")) {
    throw new Error("Add your Supabase Project URL and publishable key in supabase-config.js.");
  }

  pastVaultSupabaseClient = window.supabase.createClient(config.url, config.publishableKey);
  return pastVaultSupabaseClient;
}
