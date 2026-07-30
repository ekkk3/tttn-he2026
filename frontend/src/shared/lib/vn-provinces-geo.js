// Tọa độ TRUNG TÂM (centroid) gần đúng của 63 tỉnh/thành Việt Nam — dữ liệu địa lý hành
// chính công khai, dùng để vẽ bản đồ tuyến vận chuyển (UC 2.2.3 Theo dõi trạng thái đơn).
// LƯU Ý: đây KHÔNG phải tọa độ GPS thời gian thực của đơn hàng/xe giao — schema không lưu
// tọa độ thật và GHN address API chỉ trả tên hành chính (tỉnh/huyện/xã), không trả lat/lng
// (xem [[report-chapter3-and-sync-check]]). Bản đồ hiển thị vị trí XẤP XỈ theo tỉnh/thành
// đã đăng ký, không phải theo dõi trực tiếp vị trí xe/nhân viên giao hàng.
const PROVINCE_COORDS = {
  "ha noi": { lat: 21.0285, lng: 105.8542 },
  "ha giang": { lat: 22.8025, lng: 104.9784 },
  "cao bang": { lat: 22.6666, lng: 106.2639 },
  "bac kan": { lat: 22.1477, lng: 105.8348 },
  "tuyen quang": { lat: 21.8237, lng: 105.228 },
  "lao cai": { lat: 22.4809, lng: 103.9755 },
  "dien bien": { lat: 21.3847, lng: 103.0175 },
  "lai chau": { lat: 22.3964, lng: 103.4703 },
  "son la": { lat: 21.1023, lng: 103.729 },
  "yen bai": { lat: 21.7168, lng: 104.8986 },
  "hoa binh": { lat: 20.8133, lng: 105.3383 },
  "thai nguyen": { lat: 21.5942, lng: 105.8481 },
  "lang son": { lat: 21.853, lng: 106.761 },
  "quang ninh": { lat: 21.0064, lng: 107.2925 },
  "bac giang": { lat: 21.273, lng: 106.1946 },
  "phu tho": { lat: 21.32, lng: 105.402 },
  "vinh phuc": { lat: 21.3609, lng: 105.5474 },
  "bac ninh": { lat: 21.1861, lng: 106.0763 },
  "hai duong": { lat: 20.9373, lng: 106.3146 },
  "hai phong": { lat: 20.8449, lng: 106.6881 },
  "hung yen": { lat: 20.6464, lng: 106.0512 },
  "thai binh": { lat: 20.4463, lng: 106.3365 },
  "ha nam": { lat: 20.5835, lng: 105.9229 },
  "nam dinh": { lat: 20.4341, lng: 106.1675 },
  "ninh binh": { lat: 20.2506, lng: 105.9744 },
  "thanh hoa": { lat: 19.8067, lng: 105.7852 },
  "nghe an": { lat: 18.6791, lng: 105.6813 },
  "ha tinh": { lat: 18.3559, lng: 105.8877 },
  "quang binh": { lat: 17.4682, lng: 106.6223 },
  "quang tri": { lat: 16.7943, lng: 107.1853 },
  "thua thien hue": { lat: 16.4637, lng: 107.5909 },
  "hue": { lat: 16.4637, lng: 107.5909 },
  "da nang": { lat: 16.0544, lng: 108.2022 },
  "quang nam": { lat: 15.5736, lng: 108.474 },
  "quang ngai": { lat: 15.1213, lng: 108.8044 },
  "binh dinh": { lat: 13.782, lng: 109.2192 },
  "phu yen": { lat: 13.0882, lng: 109.0929 },
  "khanh hoa": { lat: 12.2388, lng: 109.1967 },
  "ninh thuan": { lat: 11.6739, lng: 108.8629 },
  "binh thuan": { lat: 10.928, lng: 108.1 },
  "kon tum": { lat: 14.3497, lng: 108.0005 },
  "gia lai": { lat: 13.9833, lng: 108.0 },
  "dak lak": { lat: 12.6667, lng: 108.05 },
  "dak nong": { lat: 12.2646, lng: 107.6098 },
  "lam dong": { lat: 11.9404, lng: 108.4583 },
  "binh phuoc": { lat: 11.7512, lng: 106.7235 },
  "tay ninh": { lat: 11.31, lng: 106.0989 },
  "binh duong": { lat: 11.1667, lng: 106.6667 },
  "dong nai": { lat: 10.9574, lng: 106.8426 },
  "ba ria vung tau": { lat: 10.5417, lng: 107.2431 },
  "vung tau": { lat: 10.5417, lng: 107.2431 },
  "ho chi minh": { lat: 10.7769, lng: 106.7009 },
  "sai gon": { lat: 10.7769, lng: 106.7009 },
  "long an": { lat: 10.5333, lng: 106.4167 },
  "tien giang": { lat: 10.35, lng: 106.36 },
  "ben tre": { lat: 10.2333, lng: 106.3833 },
  "tra vinh": { lat: 9.9347, lng: 106.3453 },
  "vinh long": { lat: 10.2537, lng: 105.9722 },
  "dong thap": { lat: 10.493, lng: 105.6881 },
  "an giang": { lat: 10.3878, lng: 105.4352 },
  "kien giang": { lat: 10.0125, lng: 105.0808 },
  "can tho": { lat: 10.0452, lng: 105.7469 },
  "hau giang": { lat: 9.7845, lng: 105.4701 },
  "soc trang": { lat: 9.6025, lng: 105.9739 },
  "bac lieu": { lat: 9.2941, lng: 105.7215 },
  "ca mau": { lat: 9.1769, lng: 105.1524 },
};

// Bỏ dấu tiếng Việt + hạ chữ thường + bỏ tiền tố hành chính ("Tỉnh"/"Thành phố"/"TP.") để
// khớp với nhiều cách viết khác nhau mà GHN/người dùng có thể nhập ("TP. Hồ Chí Minh",
// "Thành phố Hồ Chí Minh", "Hồ Chí Minh" đều phải trỏ về cùng 1 tọa độ).
const COMBINING_DIACRITICS_RE = new RegExp("[̀-ͯ]", "g");
function normalizeProvinceName(name) {
  return name
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS_RE, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/^(tinh|thanh pho|tp\.?|t\.p\.?)\s+/g, "")
    .trim();
}

// Trả về { lat, lng } gần đúng cho 1 tên tỉnh/thành, hoặc null nếu không nhận diện được
// (vd tên tỉnh mới lạ chưa có trong bảng tra cứu) — nơi gọi phải tự xử lý trường hợp null,
// không coi đây là lỗi vì đây chỉ là dữ liệu tham khảo, không phải nguồn dữ liệu bắt buộc.
export function findProvinceCoords(name) {
  if (!name) return null;
  return PROVINCE_COORDS[normalizeProvinceName(name)] ?? null;
}

// Kho xuất phát mặc định (Kho Heritage Harvest) — hệ thống hiện chỉ có 1 kho duy nhất và
// không lưu địa chỉ thật của kho trong schema (xem operationController.js#buildOperationOrder
// hardcode "Kho Heritage Harvest"), nên chọn Hà Nội làm gốc, khớp với ví dụ trong UC báo cáo
// (mốc thời gian mẫu ở Bảng đặc tả UC Theo dõi trạng thái đơn đều bắt đầu từ "Hà Nội").
export const WAREHOUSE_ORIGIN = { name: "Kho Heritage Harvest (Hà Nội)", lat: 21.0285, lng: 105.8542 };
