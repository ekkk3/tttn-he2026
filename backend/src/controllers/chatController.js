import axios from 'axios';
import 'dotenv/config';
import { asyncHandler } from '../utils/asyncHandler.js';

// POST /api/chat — tinh nang AI Chatbot theo de cuong (Tuan 5: "dang ky API Key AI, viet /api/chat").
// Route nay CHUA co ben repo Laravel goc, duoc them moi hoan toan trong backend Node.js.
export const chat = asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(422).json({ message: 'Thieu truong message.' });

  const provider = process.env.AI_PROVIDER || 'gemini';

  if (provider === 'openai') {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ message: 'Chua cau hinh OPENAI_API_KEY.' });
    }
    const { data } = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Ban la tro ly tu van ban dac san vung mien Viet Nam.' },
          { role: 'user', content: message },
        ],
      },
      { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }
    );
    return res.json({ reply: data.choices[0].message.content });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ message: 'Chua cau hinh GEMINI_API_KEY.' });
  }
  const { data } = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    { contents: [{ parts: [{ text: message }] }] }
  );
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Xin loi, toi chua co cau tra loi.';
  res.json({ reply });
});
