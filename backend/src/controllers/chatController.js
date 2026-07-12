import axios from 'axios';
import 'dotenv/config';
import { asyncHandler } from '../utils/asyncHandler.js';
import { query } from '../config/db.js';

// POST /api/chat — AI Chatbot tu van dac san (UC 2.2.6a).
// Uu tien OpenAI/Gemini neu co API key; neu chua cau hinh key -> fallback tra loi
// dua tren du lieu san pham that trong DB (tim theo tu khoa) de van dung duoc ngay.

async function localProductReply(message) {
  const keyword = message.trim();
  const rows = await query(
    `SELECT p.name, p.sale_price, p.origin, p.short_description, r.name AS region_name
     FROM products p LEFT JOIN regions r ON r.id = p.region_id
     WHERE p.is_active = 1 AND p.is_deleted = 0
       AND (p.name LIKE ? OR p.description LIKE ? OR p.origin LIKE ? OR r.name LIKE ?)
     ORDER BY p.stock_quantity DESC LIMIT 5`,
    [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`]
  );
  if (rows.length === 0) {
    const suggestions = await query(
      "SELECT name, sale_price FROM products WHERE is_active = 1 AND is_deleted = 0 ORDER BY stock_quantity DESC LIMIT 3"
    );
    const list = suggestions.map((p) => `• ${p.name} (${Number(p.sale_price).toLocaleString('vi-VN')}đ)`).join('\n');
    return `Mình chưa tìm thấy đặc sản khớp với "${keyword}". Một vài gợi ý phổ biến:\n${list}\nBạn có thể hỏi theo vùng miền (VD: Tây Bắc, Phú Quốc) nhé!`;
  }
  const list = rows
    .map((p) => `• ${p.name} — ${Number(p.sale_price).toLocaleString('vi-VN')}đ (${p.origin || p.region_name || 'đặc sản vùng miền'})`)
    .join('\n');
  return `Mình tìm thấy ${rows.length} đặc sản phù hợp với "${keyword}":\n${list}\nBạn muốn mình tư vấn thêm về sản phẩm nào không?`;
}

export const chat = asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(422).json({ message: 'Thieu truong message.' });

  const provider = process.env.AI_PROVIDER || 'gemini';

  try {
    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
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
      return res.json({ reply: data.choices[0].message.content, source: 'openai' });
    }

    if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
      const { data } = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { contents: [{ parts: [{ text: message }] }] }
      );
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Xin loi, toi chua co cau tra loi.';
      return res.json({ reply, source: 'gemini' });
    }
  } catch (err) {
    console.warn('[chat] Goi AI provider that bai, fallback ve tim san pham noi bo:', err.message);
  }

  // Fallback: chua cau hinh API key (hoac goi that bai) -> tra loi dua tren du lieu san pham.
  const reply = await localProductReply(message);
  res.json({ reply, source: 'local' });
});
