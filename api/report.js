export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  try {
    const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SILICONFLOW_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-ai/DeepSeek-V3',
        max_tokens: 8000,
        temperature: 0.75,
        messages: [
          {
            role: 'system',
            content: '你是一位金钱心理学专家。你的报告有三层穿透力：第一层描述表象行为，第二层揭示行为背后用户自己的核心策略，第三层指出用户从未意识到的深层恐惧和无意识习得的东西。严格按用户要求的格式输出，不截断，不添加格式外的文字。'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'API error', detail: data });

    const text = data.choices?.[0]?.message?.content || '';
    return res.status(200).json({ text });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
