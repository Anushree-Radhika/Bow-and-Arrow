import { supabase } from "./supabase";

// Row-Level Security scopes both calls to the signed-in user; no user id is ever sent.
export async function listFolders() {
  const { data, error } = await supabase.from("personal_folders").select("id, name, icon").order("name");
  if (error) throw new Error("Couldn't load your folders.");
  return data;
}

export async function createFolder(name) {
  const { data, error } = await supabase.from("personal_folders").insert({ name: name.trim() }).select("id, name, icon").single();
  if (error) throw new Error("Couldn't create that folder.");
  return data;
}
