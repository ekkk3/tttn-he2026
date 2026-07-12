import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';
import 'dotenv/config';

const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

// Xac thuc id_token (Google Identity Services) tra ve tu frontend.
// Neu chua cau hinh GOOGLE_CLIENT_ID, nem loi ro rang thay vi im lang that bai.
export async function verifyGoogleIdToken(idToken) {
  if (!googleClient) {
    throw Object.assign(new Error('Server chua cau hinh GOOGLE_CLIENT_ID.'), { status: 501 });
  }
  const ticket = await googleClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload?.email) {
    throw Object.assign(new Error('id_token Google khong hop le.'), { status: 401 });
  }
  return { providerId: payload.sub, email: payload.email, fullName: payload.name, avatarUrl: payload.picture };
}

// Xac thuc access_token Facebook bang cach goi Graph API (khong can SDK).
export async function verifyFacebookAccessToken(accessToken) {
  if (!process.env.FACEBOOK_APP_ID) {
    throw Object.assign(new Error('Server chua cau hinh FACEBOOK_APP_ID.'), { status: 501 });
  }
  const { data } = await axios.get('https://graph.facebook.com/me', {
    params: { fields: 'id,name,email,picture', access_token: accessToken },
  });
  if (!data?.id) {
    throw Object.assign(new Error('access_token Facebook khong hop le.'), { status: 401 });
  }
  if (!data.email) {
    throw Object.assign(
      new Error('Tai khoan Facebook nay khong co email cong khai, khong the dang ky.'),
      { status: 422 }
    );
  }
  return { providerId: data.id, email: data.email, fullName: data.name, avatarUrl: data.picture?.data?.url };
}
