import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { promptCategories, prompts } from './data/prompts';
import { loadRecipesFromCloud, saveRecipesToCloud, loadFavoritesFromCloud, saveFavoriteToCloud, deleteFavoriteFromCloud } from './cloud-sync';
import { AuthModal, UserMenu, useAuth } from './Auth';

const VALID_CATEGORIES = ['全部', '收藏', '配方', ...promptCategories];

function getInitialCategory() {
  // Priority 1: URL hash
  try {
    const hash = window.location.hash.slice(1);
    if (hash && VALID_CATEGORIES.includes(hash)) {
      return hash;
    }
  } catch (e) {}
  // Priority 2: localStorage
  try {
    const saved = localStorage.getItem('my_ai_active_category_v1');
    if (saved && VALID_CATEGORIES.includes(saved)) {
      return saved;
    }
  } catch (e) {}
  return '全部';
}

function setCategoryHash(category) {
  if (category === '全部') {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  } else {
    window.location.hash = category;
  }
}

const categoryIcons = {
  '景别设计': '🎬',
  '灯光技巧': '💡',
  '构图艺术': '🖼️',
  '镜头运动': '🎥',
  '色彩美学': '🎨',
  '镜头光学': '🔍',
  '质感胶片': '📽️',
  '风格类别': '✨',
  '转场类型': '🔄',
  '音频设计': '🎵',
  '配方': '🧩',
};

function App() {
  const [activeCategory, setActiveCategory] = useState(getInitialCategory);
  const [searchText, setSearchText] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState(() => {
    try {
      const raw = localStorage.getItem('my_ai_favorites_v1');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [videoError, setVideoError] = useState(false);
  const [categoryPinned, setCategoryPinned] = useState(false);
  const [copiedCount, setCopiedCount] = useState(0);
  const [recipe, setRecipe] = useState(() => {
    try {
      const raw = localStorage.getItem('my_ai_recipes_v1');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [cloudSynced, setCloudSynced] = useState(false);
  const promptsRef = useRef(prompts);

  // Auth
  const { userEmail, handleLogin, handleLogout } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // 从云端加载配方和收藏（如果有云端数据，合并到本地）
  useEffect(() => {
    if (cloudSynced) return;
    setCloudSynced(true);

    Promise.all([
      loadRecipesFromCloud(),
      loadFavoritesFromCloud(),
    ]).then(([cloudRecipes, cloudFavorites]) => {
      // 合并配方
      if (cloudRecipes && cloudRecipes.length > 0) {
        try {
          const localRaw = localStorage.getItem('my_ai_recipes_v1');
          const localRecipes = localRaw ? JSON.parse(localRaw) : [];

          const cloudIds = new Set(cloudRecipes.map(p => p.id || `${p.title}-${p.category}`));
          const merged = [
            ...cloudRecipes,
            ...localRecipes.filter(p => {
              const id = p.id || `${p.title}-${p.category}`;
              return !cloudIds.has(id);
            }),
          ];
          setRecipe(merged);
        } catch (e) {
          setRecipe(cloudRecipes);
        }
      }

      // 合并收藏
      if (cloudFavorites && cloudFavorites.length > 0) {
        try {
          const localRaw = localStorage.getItem('my_ai_favorites_v1');
          const localFavorites = localRaw ? JSON.parse(localRaw) : [];

          const merged = Array.from(new Set([...cloudFavorites, ...localFavorites]));
          setFavoriteIds(merged);
        } catch (e) {
          setFavoriteIds(cloudFavorites);
        }
      }
    });
  }, [cloudSynced]);
  const STORAGE_KEYS = {
    RECIPES: 'my_ai_recipes_v1',
    FAVORITES: 'my_ai_favorites_v1',
    ACTIVE_CATEGORY: 'my_ai_active_category_v1',
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.RECIPES, JSON.stringify(recipe));
    } catch (e) {
      // ignore
    }
    // 同步到云端（静默失败，不影响本地体验）
    saveRecipesToCloud(recipe).catch(() => {});
  }, [recipe]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favoriteIds));
    } catch (e) {
      // ignore
    }
  }, [favoriteIds]);

  useEffect(() => {
    setCategoryHash(activeCategory);
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_CATEGORY, activeCategory);
    } catch (e) {
      // ignore
    }
  }, [activeCategory]);

  const getPromptId = (prompt) => {
    if (prompt.id) return prompt.id;
    return `${prompt.title}-${prompt.category}`;
  };

  const filteredPrompts = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    if (activeCategory === '配方') {
      return recipe.filter((prompt) => {
        const matchesSearch =
          !query ||
          prompt.title.toLowerCase().includes(query) ||
          prompt.category.toLowerCase().includes(query) ||
          (prompt.content || '').toLowerCase().includes(query);
        return matchesSearch;
      });
    }

    if (activeCategory === '收藏') {
      const favSet = new Set(favoriteIds);

      // 分别收集 recipe 和 prompts 中的收藏项，避免去重导致丢失
      const recipeFavorites = recipe.filter((prompt) => favSet.has(getPromptId(prompt)));
      const promptsFavorites = prompts.filter((prompt) => favSet.has(getPromptId(prompt)));

      // 合并并去重（recipe 优先）
      const seenIds = new Set();
      const combined = [];
      recipeFavorites.forEach((p) => {
        const id = getPromptId(p);
        if (!seenIds.has(id)) {
          seenIds.add(id);
          combined.push(p);
        }
      });
      promptsFavorites.forEach((p) => {
        const id = getPromptId(p);
        if (!seenIds.has(id)) {
          seenIds.add(id);
          combined.push(p);
        }
      });

      return combined.filter((prompt) => {
        const matchesSearch =
          !query ||
          prompt.title.toLowerCase().includes(query) ||
          prompt.category.toLowerCase().includes(query) ||
          (prompt.content || '').toLowerCase().includes(query);
        return matchesSearch;
      });
    }

    return prompts.filter((prompt) => {
      const matchesCategory =
        activeCategory === '全部'
          ? true
          : prompt.category === activeCategory;
      const matchesSearch =
        !query ||
        prompt.title.toLowerCase().includes(query) ||
        prompt.category.toLowerCase().includes(query) ||
        (prompt.content || '').toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, favoriteIds, searchText, recipe]);

  const handleCopy = async (text, id) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopiedId(id);
      setCopiedCount((prev) => prev + 1);
      setTimeout(() => setCopiedId(null), 1400);
    } catch {
      setCopiedId(null);
    }
  };

  const addToRecipe = (prompt) => {
    const id = getPromptId(prompt);
    setRecipe((prev) => {
      if (prev.find((p) => p.id === id)) {
        return prev.filter((p) => p.id !== id);
      }
      return [...prev, { ...prompt, id, category: prompt.category || '配方' }];
    });
  };

  const createCustomRecipe = () => {
    const newRecipe = {
      id: `custom-${Date.now()}`,
      title: '我的新配方',
      category: '配方',
      content: '',
      custom: true,
      editing: true,
      saved: false,
    };
    setRecipe((prev) => [newRecipe, ...prev]);
    setActiveCategory('配方');
  };

  const updateRecipeField = (id, field, value) => {
    setRecipe((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, [field]: value } : item));
      // Auto-save custom recipes when title or content changes
      if (field === 'title' || field === 'content') {
        const changedItem = updated.find((item) => item.id === id);
        if (changedItem && changedItem.custom && changedItem.content && changedItem.content.trim()) {
          const autoSaved = updated.map((item) => {
            if (item.id === id && !item.saved) {
              return { ...item, saved: true };
            }
            return item;
          });
          return autoSaved;
        }
      }
      return updated;
    });
  };

  const saveRecipeCard = (id) => {
    setRecipe((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (!item.content || !item.content.trim()) return item;
        return { ...item, editing: false, saved: true };
      })
    );
  };

  const editRecipeCard = (id) => {
    setRecipe((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, editing: true } : item
      )
    );
  };

  const removeFromRecipe = (prompt) => {
    const id = getPromptId(prompt);
    setRecipe((prev) => prev.filter((p) => p.id !== id));
  };

  const clearRecipe = () => setRecipe([]);

  const copyCombinedRecipe = async () => {
    if (recipe.length === 0) return;
    const combined = recipe.map((p) => p.content).join('\n\n-----\n\n');
    await handleCopy(combined, `combined-${Date.now()}`);
  };

  const toggleFavorite = (prompt) => {
    const id = getPromptId(prompt);
    setFavoriteIds((prev) => {
      const isAdding = !prev.includes(id);
      const next = isAdding ? [...prev, id] : prev.filter((item) => item !== id);

      // 同步到云端
      if (isAdding) {
        saveFavoriteToCloud(id, prompt.title, prompt.category, prompt.content || '').catch(() => {});
      } else {
        deleteFavoriteFromCloud(id).catch(() => {});
      }

      return next;
    });
  };

  useEffect(() => {
    const handleScroll = () => {
      setCategoryPinned(window.scrollY > 260);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0A0A0A] px-3 py-3 text-slate-100 sm:px-5 lg:px-6 xl:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.16),_transparent_30%),radial-gradient(circle_at_80%_0%,_rgba(251,191,36,0.12),_transparent_28%),linear-gradient(135deg,_#050505_0%,_#0F0F0F_100%)]" />
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:42px_42px]" />

      <div className="relative mx-auto flex w-full max-w-none flex-col gap-4">
        <header className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_0_80px_rgba(0,0,0,0.35)] sm:p-8 lg:p-10">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: videoError ? '#111827' : '#1f2937' }}
          />
          <video
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            poster=""
            onError={() => setVideoError(true)}
            style={{ display: videoError ? 'none' : 'block' }}
          >
            <source src="/火焰转场.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-black/60" />

          <div className="relative mx-auto flex max-w-5xl flex-col items-center text-center">
            <div className="absolute right-0 top-0">
              <UserMenu
                userEmail={userEmail}
                onLogin={() => setAuthModalOpen(true)}
                onLogout={handleLogout}
              />
            </div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-amber-300">
              <span className="tracking-[0.25em]">AI 视频提示词宝库</span>
              <span className="rounded-full bg-black/20 px-2.5 py-0.5 text-[12px] font-semibold tracking-[0.2em] text-amber-200">
                {prompts.length} 条
              </span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl lg:text-5xl">
              用更精准的提示词，做出更像电影的短视频
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              搜索镜头、光影、构图、调色和转场语言，快速找到适合短剧、广告和概念片的创作提示词。
            </p>

            <label className="mt-7 flex w-full max-w-3xl items-center gap-3 rounded-full border border-slate-700 bg-white px-4 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.22)] sm:px-5">
              <span className="text-lg text-slate-500">🔎</span>
              <input
                type="text"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="输入关键词、分类或创作场景"
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </label>
          </div>
        </header>

        <section
          id="categories"
          className={`z-30 transition-all duration-200 ${
            categoryPinned
              ? 'fixed left-1/2 top-3 w-[calc(100%-1.5rem)] -translate-x-1/2 sm:w-[calc(100%-2.5rem)] lg:w-[calc(100%-3rem)] xl:w-[calc(100%-4rem)]'
              : 'relative'
          }`}
        >
          <div className={`overflow-x-auto rounded-full border border-white/10 bg-black/80 px-3 py-2 backdrop-blur-xl ${categoryPinned ? 'shadow-[0_10px_40px_rgba(0,0,0,0.35)]' : ''}`}>
            <div className="flex min-w-max gap-2">
            <button
              onClick={() => setActiveCategory('全部')}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                activeCategory === '全部'
                  ? 'border-amber-400 bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              全部
            </button>
            {promptCategories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition ${
                  activeCategory === category
                    ? 'border-amber-400 bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {categoryIcons[category] || '✨'} {category}
              </button>
            ))}
            <button
              onClick={() => setActiveCategory('收藏')}
              className={`rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition ${
                activeCategory === '收藏'
                  ? 'border-amber-400 bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              ★ 我的收藏
            </button>
            <button
              onClick={() => setActiveCategory('配方')}
              className={`rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition ${
                activeCategory === '配方'
                  ? 'border-amber-400 bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {categoryIcons['配方']} 我的配方
            </button>
            </div>
          </div>
        </section>
        {categoryPinned ? <div className="h-14" /> : null}

        <main id="library" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {activeCategory === '配方' && !userEmail && (
              <div className="col-span-2 rounded-xl border border-white/10 bg-white/5 p-6 text-center sm:col-span-2 lg:col-span-3 xl:col-span-4 2xl:col-span-5">
                <div className="mx-auto max-w-md">
                  <div className="mb-3 text-3xl">☁️</div>
                  <h3 className="text-lg font-semibold text-white">登录以同步配方</h3>
                  <p className="mt-2 text-sm text-slate-400">
                    登录后，你的自定义配方将永久保存在云端，换设备也能随时查看。
                  </p>
                  <button
                    onClick={() => setAuthModalOpen(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg border border-amber-400 bg-amber-500 px-4 py-2 text-sm font-medium text-black transition hover:bg-amber-400"
                  >
                    立即登录
                  </button>
                </div>
              </div>
            )}
            {activeCategory === '配方' && (
              <button
                type="button"
                key="new-recipe-card"
                onClick={createCustomRecipe}
                className="group flex min-h-[180px] w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/5 p-4 text-center text-slate-300 transition duration-200 hover:border-amber-400/40 hover:bg-white/10"
              >
                <div className="mb-3 text-4xl">＋</div>
                <div className="text-lg font-semibold text-white">新建配方</div>
                <div className="mt-2 text-sm text-slate-400">点击这里创建自定义配方内容</div>
              </button>
            )}
            {filteredPrompts.length > 0 ? (
            filteredPrompts.map((prompt) => {
              const cardId = getPromptId(prompt);
              const isCopied = copiedId === cardId;
              const canFavorite = true;

              return (
                <article
                  key={prompt.id || cardId}
                  
                  className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.28)] transition duration-200 hover:-translate-y-1 hover:border-amber-400/40"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.12),_transparent_45%)] opacity-0 transition duration-200 group-hover:opacity-100" />
                  <div className="relative flex h-full flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.3em] text-amber-400/90">{prompt.category}</p>
                        <h2 className="mt-2 text-lg font-semibold text-white">{prompt.title}</h2>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); if (canFavorite) toggleFavorite(prompt); }}
                        disabled={!canFavorite}
                        className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
                          favoriteIds.includes(cardId)
                            ? 'border-amber-400/50 bg-amber-500/20 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.24)]'
                            : canFavorite
                              ? 'border-white/10 bg-black/20 text-slate-400 hover:text-amber-300'
                              : 'border-white/10 bg-black/10 text-slate-600 opacity-50 cursor-not-allowed'
                        }`}
                        aria-label={favoriteIds.includes(cardId) ? '取消收藏' : canFavorite ? '收藏' : '不可收藏'}
                      >
                        ★
                      </button>
                    </div>

                    {prompt.editing ? (
                      <div className="flex flex-col gap-3">
                        <input
                          type="text"
                          value={prompt.title}
                          onChange={(e) => updateRecipeField(prompt.id, 'title', e.target.value)}
                          placeholder="配方名称"
                          className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
                        />
                        <textarea
                          value={prompt.content}
                          onChange={(e) => updateRecipeField(prompt.id, 'content', e.target.value)}
                          placeholder="输入你的配方内容"
                          rows={6}
                          className="min-h-[140px] rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCopy(prompt.content, prompt.id); }}
                            className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-500/20"
                          >复制</button>
                          <button
                            onClick={(e) => { e.stopPropagation(); saveRecipeCard(prompt.id); }}
                            disabled={!prompt.content || !prompt.content.trim()}
                            className={`rounded-lg border border-emerald-400/20 px-3 py-2 text-sm font-medium transition ${prompt.content && prompt.content.trim() ? 'bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20' : 'bg-white/5 text-slate-500 cursor-not-allowed'}`}
                          >创建配方卡片</button>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeFromRecipe(prompt); }}
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300"
                          >移除</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="mt-3 flex-1 text-sm leading-6 text-slate-400">{prompt.content}</p>

                        <div className="mt-4 flex justify-between flex-wrap gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCopy(prompt.content, cardId); }}
                            className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-500/20"
                          >
                            {isCopied ? '已复制' : '复制'}
                          </button>
                          {prompt.saved && !prompt.editing && (
                            <button
                              onClick={(e) => { e.stopPropagation(); editRecipeCard(prompt.id); }}
                              className="rounded-lg border border-sky-400/20 bg-sky-500/10 px-3 py-2 text-sm text-sky-200 transition hover:bg-sky-500/20"
                            >编辑</button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); addToRecipe(prompt); }}
                            className={`min-w-[84px] rounded-lg border px-3 py-2 text-sm font-medium transition ${recipe.find((p) => p.id === prompt.id || `${p.title}-${p.category}` === cardId) ? 'border-amber-400 bg-amber-500/10 text-amber-200' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}
                          >
                            {recipe.find((p) => p.id === prompt.id || `${p.title}-${p.category}` === cardId) ? '已加入配方' : '加入配方'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </article>
              );
            })
          ) : (
            <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4 2xl:col-span-5 rounded-xl border border-dashed border-white/10 bg-white/5 p-10 text-center text-slate-400">
              暂无匹配提示词，请换个关键词试试。
            </div>
          )}
        </main>

        <section className="rounded-[24px] bg-[#111111] p-3 shadow-[0_10px_30px_rgba(0,0,0,0.2)] sm:p-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: '昨日更新提示词', value: `${prompts.length} 条` },
              { label: '昨日活跃在线', value: '1.8k+' },
              { label: '累计收录爆款', value: '68 条' },
              { label: '累计被复制次数', value: `${copiedCount} 次` },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-transparent px-2 py-3 text-left sm:text-center">
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">{item.label}</p>
                <p className="mt-1 text-lg font-semibold text-white sm:text-xl">{item.value}</p>
              </div>
            ))}
          </div>
        </section>
        {recipe.length > 0 && (
          <div className="fixed left-1/2 bottom-4 z-50 w-[calc(100%-1.5rem)] -translate-x-1/2 max-w-5xl rounded-xl border border-white/10 bg-black/80 p-3 backdrop-blur-md">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 overflow-x-auto pl-1">
                <span className="text-sm text-slate-300">工作台：</span>
                {recipe.map((p) => {
                  const id = `${p.title}-${p.category}`;
                  return (
                    <div key={id} className="flex items-center gap-2 rounded-md border border-white/5 bg-white/3 px-3 py-2 text-sm text-slate-200">
                      <div className="max-w-[220px] truncate">{p.title}</div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFromRecipe(p); }}
                        className="ml-2 rounded-full bg-red-600/20 px-2 py-0.5 text-xs text-red-300"
                      >移除</button>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={copyCombinedRecipe}
                  disabled={recipe.length < 2}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${recipe.length >= 2 ? 'border-amber-400 bg-amber-500/10 text-amber-200' : 'border-white/10 bg-white/5 text-slate-400 opacity-40 cursor-not-allowed'}`}
                >
                  {recipe.length >= 2 ? `复制组合配方 (${recipe.length})` : '至少两个可组合'}
                </button>
                <button
                  onClick={() => clearRecipe()}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300"
                >清空配方</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onLogin={handleLogin}
        userEmail={userEmail}
      />
    </div>
  );
}

export default App;
