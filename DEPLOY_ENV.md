# Cloudflare Pages 环境变量配置指南

## 解决 "Supabase not configured" 错误

### 步骤：

1. **登录 Cloudflare Dashboard**
   打开 https://dash.cloudflare.com

2. **进入项目**
   - 点击左侧菜单 **Workers & Pages**
   - 找到并点击 **my-ai-video-site** 项目

3. **配置环境变量**
   - 点击顶部 **Settings** → **Environment variables**
   - 在 **Production** 部分点击 **Edit variables**

4. **添加以下两个环境变量：**

| Variable (变量名) | Value (值) |
|-------------------|-----------|
| `VITE_SUPABASE_URL` | `https://uspynsimapaywviylbdh.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_cgVZQRVFa5RuTCm0Muq81w_9t3Tc3wx` |

5. **保存并重新部署**
   - 点击 **Save** 保存环境变量
   - 回到 **Deployments** 页面
   - 点击 **Create deployment** → 选择 **GitHub** → 选择最新的 commit
   - 或者点击 **Retry deployment** 重新部署最后一次

6. **验证**
   - 等待部署完成（通常1-2分钟）
   - 访问 https://my-ai-video-site.pages.dev/
   - 点击登录按钮，确认不再显示 "Supabase not configured" 错误

---

## Supabase 数据库配置

在 Supabase Dashboard 中执行以下 SQL：

```sql
-- 如果表已存在，只需添加 in_workbench 列
ALTER TABLE recipes 
ADD COLUMN IF NOT EXISTS in_workbench BOOLEAN DEFAULT true;

UPDATE recipes 
SET in_workbench = false 
WHERE custom = true;
```

如果表不存在，先创建：

```sql
CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  content TEXT,
  category TEXT DEFAULT '配方',
  custom BOOLEAN DEFAULT false,
  saved BOOLEAN DEFAULT false,
  in_workbench BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS favorites (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  prompt_title TEXT,
  prompt_category TEXT,
  prompt_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view their own recipes"
  ON recipes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can manage their own recipes"
  ON recipes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can view their own favorites"
  ON favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can manage their own favorites"
  ON favorites FOR ALL USING (auth.uid() = user_id);
```