/**
 * 云端同步模块 - 通过 Supabase 实现用户账号云端存储
 */
import { loadRecipes, saveRecipes, loadFavorites, saveFavorite, deleteFavorite, getCurrentUser, isSupabaseConfigured } from './supabase-client';

/**
 * 从云端加载配方
 */
export async function loadRecipesFromCloud() {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data: { user } } = await getCurrentUser();
    if (!user) return null;
    return await loadRecipes();
  } catch (e) {
    console.warn('Failed to load recipes from cloud:', e);
  }
  return null;
}

/**
 * 保存配方到云端
 */
export async function saveRecipesToCloud(recipes) {
  if (!isSupabaseConfigured()) return false;
  try {
    const { data: { user } } = await getCurrentUser();
    if (!user) return false;
    return await saveRecipes(recipes);
  } catch (e) {
    console.warn('Failed to save recipes to cloud:', e);
  }
  return false;
}

/**
 * 从云端加载收藏
 */
export async function loadFavoritesFromCloud() {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data: { user } } = await getCurrentUser();
    if (!user) return null;
    const results = await loadFavorites();
    // 返回 id 数组格式，与 App.jsx 的 favoriteIds 格式一致
    return results ? results.map(f => f.id) : [];
  } catch (e) {
    console.warn('Failed to load favorites from cloud:', e);
  }
  return null;
}

/**
 * 保存单个收藏到云端
 */
export async function saveFavoriteToCloud(favoriteId, title, category, content) {
  if (!isSupabaseConfigured()) return false;
  try {
    const { data: { user } } = await getCurrentUser();
    if (!user) return false;
    return await saveFavorite({ id: favoriteId, prompt_title: title, prompt_category: category, prompt_content: content });
  } catch (e) {
    console.warn('Failed to save favorite to cloud:', e);
  }
  return false;
}

/**
 * 删除云端收藏
 */
export async function deleteFavoriteFromCloud(favoriteId) {
  if (!isSupabaseConfigured()) return false;
  try {
    const { data: { user } } = await getCurrentUser();
    if (!user) return false;
    return await deleteFavorite(favoriteId);
  } catch (e) {
    console.warn('Failed to delete favorite from cloud:', e);
  }
  return false;
}

export function isCloudConfigured() {
  return isSupabaseConfigured();
}
