import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppBootstrap } from "@/app/app-bootstrap";
import { AppRoutes } from "@/app/router";
import { FeedbackToaster } from "@/widgets/feedback-toaster";
import "@/app/styles/index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
    throw new Error("Root element #root was not found.");
}

ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
        <BrowserRouter>
            {/* AppBootstrap không render UI (return null) — chỉ chạy side-effect khởi động
                (khôi phục phiên, tải dữ liệu ban đầu) trước khi route nào cũng có thể cần đến. */}
            <AppBootstrap />
            <AppRoutes />
            {/* Hàng đợi toast toàn cục. Trước đây widget này tồn tại nhưng KHÔNG được mount ở
                đâu cả, nên mọi lời gọi pushToast() ở ~15 trang (báo lỗi nhập liệu, báo lưu
                thành công...) đều im lặng — người dùng bấm Lưu mà không thấy phản hồi gì.
                Đặt ở gốc, NGOÀI <AppRoutes> để toast không bị unmount khi đổi route. */}
            <FeedbackToaster />
        </BrowserRouter>
    </React.StrictMode>,
);
