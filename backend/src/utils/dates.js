// Tiện ích ngày tháng dùng chung cho các báo cáo/biểu đồ.

// Trả về "YYYY-MM-DD" theo GIỜ ĐỊA PHƯƠNG của máy chủ.
//
// KHÔNG dùng date.toISOString().slice(0, 10) cho việc này: toISOString() quy đổi sang UTC,
// nên ở múi giờ Việt Nam (UTC+7) mọi thời điểm từ 00:00 đến 07:00 sẽ bị lùi về ngày hôm
// trước. Trong khi đó phía SQL lại nhóm dữ liệu bằng DATE(delivered_at) — tức giờ máy chủ.
// Trộn hai hệ quy chiếu này khiến khóa tra cứu không khớp: doanh thu phát sinh rạng sáng
// không rơi vào cột nào trên biểu đồ, và cột "hôm nay" luôn hiển thị 0 trong khung giờ đó.
export function localDateIso(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
