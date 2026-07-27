import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';
import 'dotenv/config';

// audience phải khớp đúng GOOGLE_CLIENT_ID thì verifyIdToken() mới chấp nhận token —
// tránh trường hợp 1 token hợp lệ cấp cho app khác bị dùng lại ở đây.
const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

// Xác thực id_token (Google Identity Services) trả về từ frontend.
// Nếu chưa cấu hình GOOGLE_CLIENT_ID, ném lỗi rõ ràng thay vì im lặng thất bại.
export async function verifyGoogleIdToken(idToken) {
  if (!googleClient) {
    throw Object.assign(new Error('Server chưa cấu hình GOOGLE_CLIENT_ID.'), { status: 501 });
  }
  // Thư viện Google tự kiểm tra chữ ký JWT (ký bởi Google, không phải server này) + hạn dùng
  // + audience; verifyIdToken() ném lỗi nếu bất kỳ điều kiện nào sai.
  const ticket = await googleClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload?.email) {
    throw Object.assign(new Error('id_token Google không hợp lệ.'), { status: 401 });
  }
  return { providerId: payload.sub, email: payload.email, fullName: payload.name, avatarUrl: payload.picture };
}

// Xác thực access_token Facebook bằng cách gọi Graph API (không cần SDK).
export async function verifyFacebookAccessToken(accessToken) {
  if (!process.env.FACEBOOK_APP_ID) {
    throw Object.assign(new Error('Server chưa cấu hình FACEBOOK_APP_ID.'), { status: 501 });
  }
  // Không dùng SDK Facebook: chỉ cần gọi thẳng Graph API với access_token do frontend gửi
  // lên — nếu token giả/hết hạn thì chính Facebook sẽ trả lỗi ở bước gọi này.
  const { data } = await axios.get('https://graph.facebook.com/me', {
    params: { fields: 'id,name,email,picture', access_token: accessToken },
  });
  if (!data?.id) {
    throw Object.assign(new Error('access_token Facebook không hợp lệ.'), { status: 401 });
  }
  if (!data.email) {
    throw Object.assign(
      new Error('Tài khoản Facebook này không có email công khai, không thể đăng ký.'),
      { status: 422 }
    );
  }
  return { providerId: data.id, email: data.email, fullName: data.name, avatarUrl: data.picture?.data?.url };
}
