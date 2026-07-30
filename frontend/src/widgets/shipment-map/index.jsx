import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Bản đồ tuyến vận chuyển (UC 2.2.3 Theo dõi trạng thái đơn) — hiển thị vị trí kho xuất
// phát + điểm giao XẤP XỈ theo tọa độ trung tâm tỉnh/thành (xem vn-provinces-geo.js), có
// zoom in/out tương tác thật (Leaflet + OpenStreetMap, không cần API key). KHÔNG phải theo
// dõi GPS thời gian thực của xe/nhân viên giao hàng — schema không lưu tọa độ thật và GHN
// address API chỉ trả tên hành chính, không trả lat/lng.
// className: "" (reset) huỷ style mặc định của Leaflet cho div icon (nền trắng + viền) —
// tự vẽ pin tròn có màu bằng inline style thay vì thêm CSS toàn cục chỉ cho 1 widget này.
function divIcon(iconName, backgroundColor) {
    return L.divIcon({
        html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9999px;background:${backgroundColor};box-shadow:0 2px 6px rgba(0,0,0,0.35);color:#fff;">
      <span class="material-symbols-outlined" style="font-size:18px;">${iconName}</span>
    </div>`,
        className: "",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
    });
}

export function ShipmentMap({ origin, destination, destinationLabel, isDelivered }) {
    const containerRef = useRef(null);
    const mapRef = useRef(null);

    useEffect(() => {
        if (!containerRef.current || !destination) return undefined;

        const map = L.map(containerRef.current, {
            zoomControl: true,
            attributionControl: true,
            scrollWheelZoom: false,
        });
        mapRef.current = map;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 18,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);

        const originMarker = L.marker([origin.lat, origin.lng], { icon: divIcon("warehouse", "#6d4c41") })
            .addTo(map)
            .bindPopup(origin.name);
        const destinationMarker = L.marker([destination.lat, destination.lng], {
            icon: divIcon("home_pin", isDelivered ? "#2e7d32" : "#00695c"),
        })
            .addTo(map)
            .bindPopup(destinationLabel);

        const route = L.polyline(
            [
                [origin.lat, origin.lng],
                [destination.lat, destination.lng],
            ],
            { color: isDelivered ? "#2e7d32" : "#6d4c41", weight: 3, dashArray: isDelivered ? undefined : "6 6" }
        ).addTo(map);

        map.fitBounds(route.getBounds(), { padding: [32, 32] });

        // Cho phép cuộn phóng to bằng con lăn chuột CHỈ SAU KHI người dùng đã click vào bản
        // đồ — tránh việc lỡ cuộn trang (scroll qua bản đồ) lại bị bản đồ "nuốt" mất, hành vi
        // scrollWheelZoom bật sẵn thường gây khó chịu khi bản đồ nằm giữa trang dài.
        map.on("click", () => map.scrollWheelZoom.enable());

        return () => {
            originMarker.remove();
            destinationMarker.remove();
            map.remove();
            mapRef.current = null;
        };
    }, [origin, destination, destinationLabel, isDelivered]);

    if (!destination) {
        return (
            <div className="flex h-56 items-center justify-center rounded-2xl bg-surface-container-low px-4 text-center text-sm text-on-surface-variant">
                Chưa xác định được vị trí gần đúng trên bản đồ cho địa chỉ giao hàng này.
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div ref={containerRef} className="h-56 w-full overflow-hidden rounded-2xl" />
            <p className="text-center text-[11px] text-on-surface-variant">
                Vị trí xấp xỉ theo tỉnh/thành đã đăng ký — không phải theo dõi GPS thời gian thực.
            </p>
        </div>
    );
}
