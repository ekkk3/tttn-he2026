import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/shared/api/backend-client";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { Icon } from "@/shared/ui";

// Widget AI Chatbot tư vấn đặc sản (UC 2.2.6a). Gọi POST /api/chat -> { reply }.
// Backend dùng OpenAI/Gemini theo AI_PROVIDER; nếu chưa cấu hình API key sẽ trả 503
// với thông báo rõ ràng, widget hiện thông báo đó thay vì vô tình im lặng.
const WELCOME = {
    role: "assistant",
    content: "Xin chào! Mình là trợ lý đặc sản vùng miền. Bạn muốn tìm đặc sản nào?",
};

export function AiChatbot() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([WELCOME]);
    const [input, setInput] = useState("");
    const [isSending, setIsSending] = useState(false);
    const listRef = useRef(null);
    // Đã đăng nhập bằng tài khoản backend thật -> gửi kèm token để BE lưu lại hội thoại
    // (chatbot_messages) và nạp lại lịch sử cũ; khách vãng lai (token null) vẫn chat được,
    // chỉ là không có gì để lưu/nạp lại (xem chatController.js#optionalUserId).
    const accessToken = useAuthStore((state) => (state.authSource === "backend" ? state.accessToken : null));
    const hasLoadedHistoryRef = useRef(false);

    // Nạp lại hội thoại cũ MỘT LẦN khi user đăng nhập mở widget lần đầu trong phiên này —
    // không nạp lại mỗi lần đóng/mở để khỏi ghi đè tin nhắn khách vừa gõ trong lúc đang chat.
    useEffect(() => {
        if (!open || !accessToken || hasLoadedHistoryRef.current) return;
        hasLoadedHistoryRef.current = true;
        apiRequest("/chat/history", { token: accessToken })
            .then((response) => {
                const history = (response.data ?? []).map((item) => ({ role: item.role, content: item.content }));
                if (history.length > 0) {
                    setMessages([...history]);
                }
            })
            .catch(() => {
                // Lỗi khi nạp lịch sử (mất mạng...) -> giữ nguyên tin nhắn chào mặc định, không chặn chat.
            });
    }, [open, accessToken]);

    // requestAnimationFrame: đợi trình duyệt VẼ XONG tin nhắn vừa thêm vào DOM rồi mới cuộn
    // xuống cuối — gọi scrollTop ngay lập tức (trước khi React commit DOM) sẽ dùng chiều cao
    // CŨ (chưa tính tin nhắn mới), cuộn thiếu 1 nhịp.
    function scrollToBottom() {
        requestAnimationFrame(() => {
            if (listRef.current) {
                listRef.current.scrollTop = listRef.current.scrollHeight;
            }
        });
    }

    async function handleSend(event) {
        event.preventDefault();
        const text = input.trim();
        if (!text || isSending) {
            return;
        }
        setMessages((current) => [...current, { role: "user", content: text }]);
        setInput("");
        setIsSending(true);
        scrollToBottom();
        try {
            const response = await apiRequest("/chat", {
                method: "POST",
                token: accessToken || undefined,
                body: { message: text },
            });
            setMessages((current) => [...current, { role: "assistant", content: response.reply }]);
        } catch (error) {
            // Lỗi (mất mạng, hoặc backend trả 503 khi chưa cấu hình AI_PROVIDER) hiện NGAY
            // trong khung chat dưới dạng 1 tin nhắn "assistant" có tiền tố cảnh báo — không
            // dùng toast/alert riêng, để cuộc trò chuyện không bị gián đoạn luồng hiển thị.
            const message = error instanceof Error ? error.message : "Xin lỗi, hiện chưa thể trả lời.";
            setMessages((current) => [
                ...current,
                { role: "assistant", content: `⚠️ ${message}` },
            ]);
        } finally {
            setIsSending(false);
            scrollToBottom();
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg shadow-primary/30 transition-transform hover:scale-105"
                aria-label="Mở trợ lý AI"
            >
                <Icon name={open ? "close" : "smart_toy"} />
            </button>

            {open ? (
                <div className="fixed bottom-24 right-6 z-50 flex h-[28rem] w-[22rem] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-3xl border border-outline-variant/20 bg-surface shadow-2xl">
                    <div className="flex items-center gap-3 border-b border-outline-variant/15 bg-primary/5 px-4 py-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-on-primary">
                            <Icon name="smart_toy" className="text-lg" />
                        </div>
                        <div>
                            <p className="font-semibold text-on-surface">Trợ lý đặc sản AI</p>
                            <p className="text-xs text-on-surface-variant">Tư vấn sản phẩm vùng miền</p>
                        </div>
                    </div>

                    <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                        {messages.map((message, index) => (
                            <div
                                key={index}
                                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-6 ${
                                        message.role === "user"
                                            ? "bg-primary text-on-primary"
                                            : "bg-surface-container-highest text-on-surface"
                                    }`}
                                >
                                    {message.content}
                                </div>
                            </div>
                        ))}
                        {isSending ? (
                            <div className="flex justify-start">
                                <div className="rounded-2xl bg-surface-container-highest px-3 py-2 text-sm text-on-surface-variant">
                                    Đang soạn trả lời...
                                </div>
                            </div>
                        ) : null}
                    </div>

                    <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-outline-variant/15 px-3 py-3">
                        <input
                            className="min-w-0 flex-1 rounded-full bg-surface-container-highest px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/15"
                            placeholder="Nhập câu hỏi..."
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            disabled={isSending}
                        />
                        <button
                            type="submit"
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-on-primary disabled:opacity-50"
                            disabled={isSending || !input.trim()}
                            aria-label="Gửi"
                        >
                            <Icon name="send" className="text-lg" />
                        </button>
                    </form>
                </div>
            ) : null}
        </>
    );
}
