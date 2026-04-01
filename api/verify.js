export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageData, mediaType, visionPrompt } = req.body;

  if (!imageData || !mediaType || !visionPrompt) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const parts = visionPrompt.split(' | JUDGING RULES: ');
  const whatToLookFor = parts[0].replace('WHAT TO LOOK FOR: ', '').trim();
  const systemPrompt = parts[1] || `You are a generous and encouraging judge for a family treasure hunt game. Your default is to ACCEPT the photo. Only reject if the photo is completely and obviously wrong — e.g. a blank wall, a random sky, someone's feet, or clearly nothing relevant at all. If there is any reasonable chance the photo matches the description, say found=true. Reply ONLY with valid JSON, no markdown: {"found": true or false, "message": "A warm fun line for a child, max 12 words."}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageData
              }
            },
            {
              type: 'text',
              text: `Does this photo show: ${whatToLookFor}\n\nReply with JSON only.`
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic error:', err);
      return res.status(500).json({ error: 'Anthropic API error' });
    }

    const data = await response.json();
    const raw = data.content
      .map(b => b.text || '')
      .join('')
      .replace(/```json|```/g, '')
      .trim();

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      return res.status(500).json({ error: 'Could not parse response' });
    }

    const result = JSON.parse(match[0]);
    return res.status(200).json(result);

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
