/**
 * 云端同步模块 - 通过 Supabase 实现用户账号云端存储
 */
import { loadRecipes, loadFavorites, saveFavorite, deleteFavorite, getCurrentUser, isSupabaseConfigured, subscribeToRecipes as subscribeToRecipesImpl, unsubscribeFromRecipes as unsubscribeFromRecipesImpl, uploadRecipe as uploadRecipeImpl } from './supabase-client';

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

/**
 * 删除云端单个配方
 */
export async function deleteRecipeFromCloud(recipeId) {
  if (!isSupabaseConfigured()) return false;
  try {
    const { data: { user } } = await getCurrentUser();
    if (!user) return false;
    const { supabase } = await import('./supabase-client');
    if (!supabase) return false;
    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', recipeId)
      .eq('user_id', user.id);
    return !error;
  } catch (e) {
    console.warn('Failed to delete recipe from cloud:', e);
  }
  return false;
}

export function isCloudConfigured() {
  return isSupabaseConfigured();
}

/**
 * 订阅云端配方变化（实时同步）
 */
export function subscribeToRecipes(onRecipesChanged) {
  if (!isSupabaseConfigured()) return null;
  return subscribeToRecipesImpl(onRecipesChanged);
}

/**
 * 取消订阅
 */
export function unsubscribeFromRecipes(channel) {
  unsubscribeFromRecipesImpl(channel);
}

/**
 * 上传单条配方到云端（手动上传）
 */
export async function uploadRecipeToCloud(recipe) {
  if (!isSupabaseConfigured()) return false;
  try {
    const { data: { user } } = await getCurrentUser();
    if (!user) return false;
    return await uploadRecipeImpl(recipe);
  } catch (e) {
    console.warn('Failed to upload recipe to cloud:', e);
  }
  return false;
}
