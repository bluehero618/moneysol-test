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
        temperature: 0.75,
        stream: true,
        messages: [
          {
            role: 'system',
            content: `你是一位深度心理咨询师，受过荣格分析心理学训练。你擅长从一个人的日常行为模式中，看见背后的无意识动力、童年情结和深层信念。

你的写作风格：
- 从可观察的具体行为出发，逐层深入，从现象到心理策略，到童年来源，到无意识动力
- 每个板块有清晰的内在逻辑和层次，读起来像剥洋葱，一层比一层深
- 语言通俗，不用"阴影""原型""集体无意识"等学术术语，但保有深度
- 段落有展开，每段有完整的意思，不是一句话的断言
- 语气像一个认真看见对方的人，温和但不回避，清醒但不冷漠
- 不用**符号，不用Q编号，不用"这说明""这意味着"
- 每段严格控制在60字以内，超过就换段，段间空一行
- 禁止出现超过3句话的连续段落，一个意思说完立刻换行
- 严格按===格式输出，===外不加任何文字`
          },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!upstream.ok) {
      const err = await upstream.json();
      return res.status(500).json({ error: err.error?.message || 'API error' });
    }

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
