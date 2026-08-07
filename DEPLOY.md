# 部署指南

## 方式一：Vercel 部署（推荐，最简单）

### 步骤：
1. 访问 https://vercel.com 并注册账号
2. 点击 "New Project"
3. 连接您的 Git 仓库（需要将代码推送到 GitHub/GitLab）
4. Vercel 会自动检测 Vite 项目配置
5. 点击 "Deploy" 即可完成部署

### 环境变量配置：
在 Vercel Dashboard 的项目设置中添加：
- `VITE_SUPABASE_URL`: 您的 Supabase URL
- `VITE_SUPABASE_ANON_KEY`: 您的 Supabase Anon Key

---

## 方式二：GitHub + Vercel 自动部署

### 1. 初始化 Git 仓库（如果还没有）
```bash
git init
git add .
git commit -m "initial commit"
```

### 2. 推送到 GitHub
```bash
git remote add origin https://github.com/your-username/my-ai-video-site.git
git branch -M main
git push -u origin main
```

### 3. 在 Vercel 导入
- 访问 https://vercel.com/new
- 选择 "Import Git Repository"
- 选择您的 GitHub 仓库
- 配置环境变量
- 点击 Deploy

---

## 方式三：本地构建后部署到任意服务器

### 1. 构建项目
```bash
npm run build
```

### 2. 上传 dist 目录到服务器
构建完成后，`dist` 目录包含所有静态文件，可以部署到：
- Nginx
- Apache
- 阿里云 OSS
- 腾讯云 COS
- 任何静态网站托管服务

### Nginx 配置示例：
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 方式四：Cloudflare Pages

1. 访问 https://pages.cloudflare.com
2. 连接 Git 仓库
3. 构建命令：`npm run build`
4. 输出目录：`dist`
5. 添加环境变量 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`

---

## Supabase 数据库配置

部署前，需要在 Supabase 执行以下 SQL 创建数据表：

```sql
-- 创建 recipes 表
CREATE TABLE recipes (
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

-- 创建 favorites 表
CREATE TABLE favorites (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  prompt_title TEXT,
  prompt_category TEXT,
  prompt_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加索引
CREATE INDEX idx_recipes_user_id ON recipes(user_id);
CREATE INDEX idx_favorites_user_id ON favorites(user_id);

-- 启用行级安全策略
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- 创建策略
CREATE POLICY "Users can view their own recipes"
  ON recipes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own recipes"
  ON recipes FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own favorites"
  ON favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own favorites"
  ON favorites FOR ALL
  USING (auth.uid() = user_id);
```