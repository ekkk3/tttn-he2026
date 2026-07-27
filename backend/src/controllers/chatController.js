import axios from 'axios';
import 'dotenv/config';
import { asyncHandler } from '../utils/asyncHandler.js';
import { query } from '../config/db.js';

// POST /api/chat — AI Chatbot tư vấn đặc sản (UC 2.2.6a).
// Ưu tiên OpenAI/Gemini nếu có API key; nếu chưa cấu hình key -> fallback trả lời
// dựa trên dữ liệu sản phẩm thật trong DB (tìm theo từ khóa) để vẫn dùng được ngay.

// Fallback "giả AI": không gọi model ngôn ngữ nào cả, chỉ LIKE-search từ khóa trong tên/mô
// tả/nguồn gốc sản phẩm rồi dựng câu trả lời từ dữ liệu thật — dùng khi chưa có API key
// OpenAI/Gemini, hoặc khi gọi provider thật bị lỗi (xem catch bên dưới).
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
  if (!message) return res.status(422).json({ message: 'Thiếu trường message.' });

  const provider = process.env.AI_PROVIDER || 'gemini';

  // Cả 2 nhánh if bên dưới đều return ngay khi gọi API thành công. Nếu provider không khớp,
  // hoặc thiếu API key, hoặc lệnh gọi ném lỗi (bắt ở catch) — code sẽ "rơi" xuống hết khối
  // try/catch này mà không return, tới thẳng fallback localProductReply() ở cuối hàm.
  try {
    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      const { data } = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Bạn là trợ lý tư vấn bán đặc sản vùng miền Việt Nam.' },
            { role: 'user', content: message },
          ],
        },
        { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }
      );
      return res.json({ reply: data.choices[0].message.content, source: 'openai' });
    }

    if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
      // gemini-1.5-flash đã bị Google ngừng hỗ trợ (trả về 404) — dùng alias
      // "gemini-flash-latest" để luôn trỏ tới model flash hiện hành, tránh phải
      // sửa code lại mỗi khi Google deprecate một phiên bản model cụ thể.
      const { data } = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { contents: [{ parts: [{ text: message }] }] }
      );
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Xin lỗi, tôi chưa có câu trả lời.';
      return res.json({ reply, source: 'gemini' });
    }
  } catch (err) {
    console.warn('[chat] Gọi AI provider thất bại, fallback về tìm sản phẩm nội bộ:', err.message);
  }

  // Fallback: chưa cấu hình API key (hoặc gọi thất bại) -> trả lời dựa trên dữ liệu sản phẩm.
  const reply = await localProductReply(message);
  res.json({ reply, source: 'local' });
});
