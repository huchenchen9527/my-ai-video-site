import { createClient } from '@supabase/supabase-js'

// 开发环境走本地代理，线上环境直连 Supabase
const supabaseUrl = import.meta.env.DEV
  ? (import.meta.env.VITE_SUPABASE_URL || 'http://localhost:3000/supabase')
  : import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export function isSupabaseConfigured() {
  return !!(supabaseUrl && supabaseAnonKey);
}

export async function signUp(email, password) {
  if (!supabase) return { data: null, error: new Error('Supabase not configured') };
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { data, error };
}

export async function signIn(email, password) {
  if (!supabase) return { data: null, error: new Error('Supabase not configured') };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signOut() {
  if (!supabase) return { error: null };
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getCurrentUser() {
  if (!supabase) return { data: { user: null }, error: null };
  const { data, error } = await supabase.auth.getUser();
  return { data, error };
}

export function onAuthChange(callback) {
  if (!supabase) return { data: { subscription: null } };
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}

// 加载配方
export async function loadRecipes() {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Failed to load recipes:', error);
    return null;
  }
  return data || [];
}

// 保存配方列表（全量覆盖）
export async function saveRecipes(recipes) {
  if (!supabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // 先删除用户所有旧配方
  await supabase.from('recipes').delete().eq('user_id', user.id);

  if (!recipes || recipes.length === 0) return true;

  // 批量插入新配方
  const records = recipes.map(recipe => ({
    id: recipe.id || `${recipe.title}-${recipe.category}`,
    user_id: user.id,
    title: recipe.title,
    content: recipe.content || '',
    category: recipe.category || '配方',
    custom: recipe.custom || false,
    saved: recipe.saved || false,
    in_workbench: recipe.inWorkbench !== undefined ? recipe.inWorkbench : true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('recipes').insert(records);

  if (error) {
    console.warn('Failed to save recipes:', error);
    return false;
  }
  return true;
}

// 加载收藏
export async function loadFavorites() {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('favorites')
    .select('*')
    .eq('user_id', user.id);

  if (error) {
    console.warn('Failed to load favorites:', error);
    return null;
  }
  return data || [];
}

// 保存收藏
export async function saveFavorite(favorite) {
  if (!supabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { id, prompt_title, prompt_category, prompt_content } = favorite;

  const { error } = await supabase
    .from('favorites')
    .upsert({ id, user_id: user.id, prompt_title, prompt_category, prompt_content });

  if (error) console.warn('Failed to save favorite:', id);
  return !error;
}

// 删除收藏
export async function deleteFavorite(id) {
  if (!supabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  return !error;
}

// 加载用户统计
export async function loadStats() {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // 没有记录
    console.warn('Failed to load stats:', error);
    return null;
  }
  return data;
}

// 保存用户统计到云端
export async function saveStats(copiedCount) {
  if (!supabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('user_stats')
    .upsert({
      user_id: user.id,
      copied_count: copiedCount,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (error) {
    console.warn('Failed to save stats:', error);
    return false;
  }
  return true;
}