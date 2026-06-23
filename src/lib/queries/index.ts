import type { PostgrestError } from "@supabase/supabase-js";

export function unwrap<T>(data: T | null, error: PostgrestError | null): T {
  if (error) throw error;
  if (data == null) throw new Error("No data returned");
  return data;
}

export { queryKeys } from "./keys";
