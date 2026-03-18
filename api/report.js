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

你的写作风格基准（严格照这个风格写）：
「你帮人做了件事，对方坚持要付钱，你收了。
但收完之后，心里有个声音一直在说：是不是要多了？
这个声音不是良心，也不是谦虚。
它是一条你在很小的时候就学会的规则——主动要钱，是让人不舒服的事。
这条规则不是某人明确告诉你的。
它是从气氛里渗进来的。父母谈钱时压低的声音，商店里那句"太贵了走吧"，某次你开口要什么，对方脸上一闪而过的为难。
你是个敏感的孩子。你注意到了。
你用感觉记住了：关于钱的渴望，是需要藏起来的东西。」

核心规则：
- 从具体行为出发，逐层深入：现象→心理规则→童年来源→当下影响
- 直接描述心理事实，不用比喻、不用意象、不用修辞
- 禁止"不是X是Y"句式，禁止比喻，禁止**符号，禁止Q编号，禁止"这说明""这意味着"
- 语言通俗，不用心理学术语，但有深度和层次
- 语气像一个认真看见对方的人，温和但不回避
- 每段严格控制在60字以内，超过就换段，段间空一行
- 禁止出现超过3句话的连续段落
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
