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

// 实时订阅 recipes 表变化
export function subscribeToRecipes(onRecipesChanged) {
  if (!supabase) return null;
  
  const channel = supabase
    .channel('recipes-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'recipes' },
      (payload) => {
        onRecipesChanged(payload);
      }
    )
    .subscribe();
  
  return channel;
}

// 取消订阅
export function unsubscribeFromRecipes(channel) {
  if (supabase && channel) {
    supabase.removeChannel(channel);
  }
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
    inWorkbench: r.in_workbench !== undefined && r.in_workbench !== null ? r.in_workbench : false,
  }));
}

// 保存单条配方到云端（上传功能）
export async function uploadRecipe(recipe) {
  if (!supabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const id = recipe.id || `${recipe.title}-${recipe.category}`;

  const { error } = await supabase
    .from('recipes')
    .upsert({
      id,
      user_id: user.id,
      title: recipe.title,
      content: recipe.content || '',
      category: recipe.category || '配方',
      custom: true,
      saved: true,
      in_workbench: recipe.inWorkbench !== undefined ? recipe.inWorkbench : false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

  if (error) {
    console.warn('Failed to upload recipe:', error);
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

// 加载累计收录总数统计
export async function loadTotalCount() {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_stats')
    .select('total_count')
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.warn('Failed to load total_count:', error);
    return null;
  }
  return (data && data.total_count) || 0;
}

// 更新累计收录总数统计
export async function updateTotalCount(count) {
  if (!supabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('user_stats')
    .upsert({
      user_id: user.id,
      total_count: count,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id'
    });

  if (error) {
    console.warn('Failed to update total_count:', error);
    return false;
  }

  return true;
}

// 加载复制次数统计
export async function loadCopiedCount() {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_stats')
    .select('copied_count')
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.warn('Failed to load copied_count:', error);
    return null;
  }
  return (data && data.copied_count) || 0;
}

// 更新复制次数统计（递增 1）
export async function incrementCopiedCount() {
  if (!supabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // 先查询当前值
  const { data, error: fetchError } = await supabase
    .from('user_stats')
    .select('copied_count')
    .eq('user_id', user.id)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.warn('Failed to fetch copied_count:', fetchError);
    return false;
  }

  const currentCount = (data && data.copied_count) || 0;
  const newCount = currentCount + 1;

  // 使用 upsert 插入或更新
  const { error } = await supabase
    .from('user_stats')
    .upsert({
      user_id: user.id,
      copied_count: newCount,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id'
    });

  if (error) {
    console.warn('Failed to update copied_count:', error);
    return false;
  }

  return true;
}