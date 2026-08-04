import axios from 'axios';
import 'dotenv/config';
import { asyncHandler } from '../utils/asyncHandler.js';
import { query } from '../config/db.js';
import { verifyToken } from '../utils/jwt.js';
import { escapeLike } from '../utils/sql.js';

// POST /api/chat — AI Chatbot tư vấn đặc sản (UC 2.2.6a).
// Ưu tiên OpenAI/Gemini nếu có API key; nếu chưa cấu hình key -> fallback trả lời
// dựa trên dữ liệu sản phẩm thật trong DB (tìm theo từ khóa) để vẫn dùng được ngay.

// Route /chat CỐ TÌNH đặt TRƯỚC router.use(auth) trong api.routes.js (UC cho phép khách
// vãng lai chưa đăng nhập vẫn chat được) — nên không thể dùng middleware auth() thông
// thường (báo lỗi 401 nếu thiếu token). Hàm này tự thử giải mã token NẾU CÓ, im lặng bỏ
// qua nếu không có/token hỏng, để phân biệt "khách vãng lai" (userId null, không lưu lịch
// sử) với "đã đăng nhập" (userId thật, lưu lại hội thoại vào chatbot_messages).
function optionalUserId(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    return verifyToken(token).sub;
  } catch {
    return null;
  }
}

async function saveMessage(userId, role, content, source) {
  if (!userId) return;
  await query(
    'INSERT INTO chatbot_messages (user_id, role, content, source) VALUES (?, ?, ?, ?)',
    [userId, role, content, source || null]
  );
}

// GET /api/chat/history — nạp lại hội thoại cũ khi khách (đã đăng nhập) mở lại widget chat.
// Route này nằm SAU router.use(auth) nên req.user luôn có sẵn (bắt buộc đăng nhập) — khách
// vãng lai không có lịch sử để nạp nên không cần endpoint public riêng cho trường hợp đó.
export const chatHistory = asyncHandler(async (req, res) => {
  const rows = await query(
    'SELECT role, content, source, created_at FROM chatbot_messages WHERE user_id = ? ORDER BY id ASC LIMIT 50',
    [req.user.id]
  );
  res.json({ data: rows });
});

// Fallback "giả AI": không gọi model ngôn ngữ nào cả, chỉ LIKE-search từ khóa trong tên/mô
// tả/nguồn gốc sản phẩm rồi dựng câu trả lời từ dữ liệu thật — dùng khi chưa có API key
// OpenAI/Gemini, hoặc khi gọi provider thật bị lỗi (xem catch bên dưới).
async function localProductReply(message) {
  const keyword = message.trim();
  // escapeLike: khách gõ đúng 1 dấu "_"/"%" vào tin nhắn (message chính là từ khóa LIKE ở
  // đây) sẽ khớp mọi sản phẩm thay vì không sản phẩm nào — cùng lỗi đã sửa ở productController.
  const term = escapeLike(keyword);
  const rows = await query(
    `SELECT p.name, p.sale_price, p.origin, p.short_description, r.name AS region_name
     FROM products p LEFT JOIN regions r ON r.id = p.region_id
     WHERE p.is_active = 1 AND p.is_deleted = 0
       AND (p.name LIKE ? OR p.description LIKE ? OR p.origin LIKE ? OR r.name LIKE ?)
     ORDER BY p.stock_quantity DESC LIMIT 5`,
    [`%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`]
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

// ---------------------------------------------------------------------------
// Ngữ cảnh gửi kèm cho model (UC 2.2.6a bước 4: "ChatbotController tổng hợp ngữ cảnh
// (lịch sử hội thoại, dữ liệu sản phẩm liên quan nếu cần) và gọi API").
//
// Trước đây cả 2 nhánh chỉ gửi mỗi câu hỏi thô, hậu quả kiểm chứng được:
//   - Hỏi "gợi ý đặc sản Tây Bắc dưới 200k" -> bot giới thiệu "Bánh hạt dẻ Sapa", "Bánh chưng
//     gù Hà Giang" kèm giá tự bịa. Đó là hàng KHÔNG bán ở đây, trong khi "Măng khô Tây Bắc
//     120.000đ" đang bán thật thì không được nhắc — tức là website tự quảng cáo hàng của
//     người khác cho khách của mình.
//   - Lượt 1 "tôi tên Trang" -> "đã nhớ tên bạn"; lượt 2 "tôi vừa nói tên gì?" -> "bạn chưa
//     cho tôi biết tên". Lịch sử VẪN được lưu vào chatbot_messages nhưng không ai gửi lại
//     cho model, nên model không có gì để nhớ.
// ---------------------------------------------------------------------------

// Chỉ thị vai trò cho model. Ràng buộc quan trọng nhất: chỉ được tư vấn trong danh mục hàng
// thật của cửa hàng, không tự nghĩ ra sản phẩm/giá.
const SYSTEM_PROMPT = `Bạn là trợ lý tư vấn của website thương mại điện tử bán đặc sản vùng miền Việt Nam.
Nguyên tắc bắt buộc:
- CHỈ giới thiệu sản phẩm có trong "DANH SÁCH SẢN PHẨM ĐANG BÁN" bên dưới. Tuyệt đối không bịa tên sản phẩm hay giá không có trong danh sách.
- Khi gợi ý, nêu đúng tên và đúng giá lấy từ danh sách đó.
- Nếu không có sản phẩm nào phù hợp với yêu cầu của khách, hãy nói thẳng là cửa hàng chưa có mặt hàng đó và gợi ý vài sản phẩm gần nhất đang bán.
- Trả lời ngắn gọn bằng tiếng Việt, thân thiện, không dùng bảng biểu phức tạp.
- KHÔNG dùng ký hiệu markdown (**, ##, \`\`\`, danh sách đánh số lồng nhau) vì cửa sổ chat hiển thị nguyên văn ký tự, gạch đầu dòng "-" thì được.
- Từ chối lịch sự các câu hỏi ngoài phạm vi mua sắm đặc sản và mời khách liên hệ bộ phận CSKH.`;

// Danh mục hàng thật, kèm giá/tồn kho/vùng miền để model tư vấn đúng dữ liệu đang bán.
// Giới hạn 60 sản phẩm cho đủ dùng mà không phình prompt (hệ thống hiện có vài chục mặt hàng);
// nếu sau này catalog lớn lên thì nên đổi sang lọc theo từ khóa câu hỏi thay vì gửi tất cả.
async function buildCatalogContext() {
  const rows = await query(
    `SELECT p.name, p.sale_price, p.stock_quantity, p.origin,
            c.name AS category_name, r.name AS region_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN regions r ON r.id = p.region_id
     WHERE p.is_active = 1 AND p.is_deleted = 0
     ORDER BY p.stock_quantity DESC LIMIT 60`
  );
  if (!rows.length) return 'DANH SÁCH SẢN PHẨM ĐANG BÁN: (hiện chưa có sản phẩm nào)';
  const lines = rows.map((p) => {
    const parts = [
      `- ${p.name}`,
      `${Number(p.sale_price).toLocaleString('vi-VN')}đ`,
      p.category_name || 'chưa phân loại',
      p.region_name || p.origin || 'chưa rõ vùng miền',
      p.stock_quantity > 0 ? 'còn hàng' : 'hết hàng',
    ];
    return parts.join(' | ');
  });
  return `DANH SÁCH SẢN PHẨM ĐANG BÁN:\n${lines.join('\n')}`;
}

// Lịch sử hội thoại gần nhất của chính khách này (bỏ qua với khách vãng lai vì không có
// phiên ổn định để gắn lịch sử). Lấy 10 tin cuối để model nhớ được mạch nói chuyện mà
// không làm prompt dài quá.
async function loadRecentHistory(userId) {
  if (!userId) return [];
  const rows = await query(
    'SELECT role, content FROM chatbot_messages WHERE user_id = ? ORDER BY id DESC LIMIT 10',
    [userId]
  );
  return rows.reverse(); // Query lấy ngược từ mới -> cũ, đảo lại cho đúng thứ tự hội thoại.
}

export const chat = asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(422).json({ message: 'Thiếu trường message.' });

  const userId = optionalUserId(req);
  const provider = process.env.AI_PROVIDER || 'gemini';
  let reply;
  let source;

  // Dựng ngữ cảnh TRƯỚC khi gọi provider, dùng chung cho cả nhánh OpenAI lẫn Gemini.
  const catalogContext = await buildCatalogContext();
  const history = await loadRecentHistory(userId);

  // Cả 2 nhánh if bên dưới đều gán reply/source rồi break ra khỏi try khi gọi API thành
  // công. Nếu provider không khớp, hoặc thiếu API key, hoặc lệnh gọi ném lỗi (bắt ở catch)
  // — reply vẫn undefined, rơi xuống fallback localProductReply() bên dưới khối try/catch.
  try {
    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      const { data } = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: `${SYSTEM_PROMPT}\n\n${catalogContext}` },
            // Lịch sử cũ chèn vào giữa system prompt và câu hỏi mới, đúng định dạng
            // role user/assistant mà OpenAI dùng.
            ...history.map((h) => ({ role: h.role, content: h.content })),
            { role: 'user', content: message },
          ],
        },
        { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }
      );
      reply = data.choices[0].message.content;
      source = 'openai';
    } else if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
      // gemini-1.5-flash đã bị Google ngừng hỗ trợ (trả về 404) — dùng alias
      // "gemini-flash-latest" để luôn trỏ tới model flash hiện hành, tránh phải
      // sửa code lại mỗi khi Google deprecate một phiên bản model cụ thể.
      //
      // Gemini gọi vai trò của model là "model" (OpenAI gọi là "assistant") nên phải đổi tên
      // khi map lịch sử; chỉ thị hệ thống thì đặt riêng ở "systemInstruction".
      const { data } = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          systemInstruction: { parts: [{ text: `${SYSTEM_PROMPT}\n\n${catalogContext}` }] },
          contents: [
            ...history.map((h) => ({
              role: h.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: h.content }],
            })),
            { role: 'user', parts: [{ text: message }] },
          ],
        }
      );
      reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Xin lỗi, tôi chưa có câu trả lời.';
      source = 'gemini';
    }
  } catch (err) {
    console.warn('[chat] Gọi AI provider thất bại, fallback về tìm sản phẩm nội bộ:', err.message);
  }

  // Fallback: chưa cấu hình API key (hoặc gọi thất bại) -> trả lời dựa trên dữ liệu sản phẩm.
  if (reply === undefined) {
    reply = await localProductReply(message);
    source = 'local';
  }

  // Chỉ lưu lại khi đã đăng nhập (UC 2.2.6a "hội thoại được lưu lại") — khách vãng lai vẫn
  // chat bình thường nhưng không có phiên ổn định để gắn lịch sử (xem optionalUserId ở trên).
  await saveMessage(userId, 'user', message, null);
  await saveMessage(userId, 'assistant', reply, source);

  res.json({ reply, source });
});
