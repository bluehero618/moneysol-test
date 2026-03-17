export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  try {
    const upstream = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SILICONFLOW_API_KEY}`
      },
      body: JSON.stringify({
        model: 'Pro/deepseek-ai/DeepSeek-V3',
        max_tokens: 4000,
        temperature: 0.7,
        stream: true,
        messages: [
          {
            role: 'system',
            content: '你是金钱心理学专家。每个想法单独一段。短句。直接陈述逻辑。不用比喻，不用Q编号，不用**等符号，不用"这说明""这意味着"。严格按===格式输出，===外不加任何文字。'
          },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!upstream.ok) {
      const err = await upstream.json();
      return res.status(500).json({ error: err.error?.message || 'API error' });
    }

    // 流式：把上游SSE直接透传给前端，前端自己解析
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        // 直接透传原始SSE行给前端，不做任何包装
        if (line.trim()) {
          res.write(line + '\n');
        }
      }
      res.write('\n');
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.end();
    }
  }
}
