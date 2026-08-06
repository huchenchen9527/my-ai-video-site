/**
 * Cloudflare Workers API - 配方云端存储
 * 部署说明：
 * 1. 在 Cloudflare Dashboard -> Workers -> Create Application
 * 2. 选择 "Single Worker" 模式
 * 3. 粘贴以下代码
 * 4. 添加 KV 命名空间绑定：变量名 RECIPES_KV，命名空间名 recipes-data
 */

export default {
  async fetch(request, env) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // GET /api/recipes/:deviceId - 获取配方
    if (request.method === 'GET' && path.startsWith('/api/recipes/')) {
      const deviceId = path.split('/').pop();
      const data = await env.RECIPES_KV.get(`recipes:${deviceId}`);
      const recipes = data ? JSON.parse(data) : [];

      return new Response(JSON.stringify({ success: true, data: recipes }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /api/recipes/:deviceId - 保存配方
    if (request.method === 'POST' && path.startsWith('/api/recipes/')) {
      const deviceId = path.split('/').pop();
      const body = await request.json();

      await env.RECIPES_KV.put(`recipes:${deviceId}`, JSON.stringify(body.recipes));

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
};
