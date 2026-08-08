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
  return (data || []).map(r => ({
    ...r,
    inWorkbench: r.in_workbench !== undefined ? r.in_workbench : true,
  }));
}

// 保存配方列表（使用 upsert 替代先删后插，避免数据丢失）
export async function saveRecipes(recipes) {
  if (!supabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // 获取云端现有配方 ID 集合
  const { data: existing } = await supabase
    .from('recipes')
    .select('id')
    .eq('user_id', user.id);

  const existingIds = new Set((existing || []).map(r => r.id));

  // 构建新配方 ID 集合
  const newRecords = (recipes || []).map(recipe => {
    const id = recipe.id || `${recipe.title}-${recipe.category}`;
    return {
      id,
      user_id: user.id,
      title: recipe.title,
      content: recipe.content || '',
      category: recipe.category || '配方',
      custom: recipe.custom || false,
      saved: recipe.saved || false,
      in_workbench: recipe.inWorkbench !== undefined ? recipe.inWorkbench : true,
      updated_at: new Date().toISOString(),
    };
  });

  const newIds = new Set(newRecords.map(r => r.id));

  // 删除云端有但本地不存在的配方（用户已删除的）
  const toDelete = [...existingIds].filter(id => !newIds.has(id));
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from('recipes')
      .delete()
      .eq('user_id', user.id)
      .in('id', toDelete);
    if (delErr) console.warn('Failed to delete removed recipes:', delErr);
  }

  // 使用 upsert 批量插入或更新
  if (newRecords.length > 0) {
    const { error } = await supabase
      .from('recipes')
      .upsert(newRecords, { onConflict: 'id' });

    if (error) {
      console.warn('Failed to save recipes:', error);
      return false;
    }
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
    .upsert({ id, user_id: user.id, prompt_title, prompt_category, prompt_content }, { onConflict: 'id' });

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