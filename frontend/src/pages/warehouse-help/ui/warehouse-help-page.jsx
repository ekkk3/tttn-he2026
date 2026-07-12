import { useEffect, useState } from "react";
import { useFeedbackStore } from "@/shared/lib/store/use-feedback-store";
import { useOperationsDataStore } from "@/shared/lib/store/use-operations-data-store";
import { AdminPageHeader, Button, SurfaceCard } from "@/shared/ui";
export function WarehouseHelpPage() {
    const createSupportTicket = useOperationsDataStore((state) => state.createSupportTicket);
    const resolveSupportTicket = useOperationsDataStore((state) => state.resolveSupportTicket);
    const supportTickets = useOperationsDataStore((state) => state.supportTickets);
    const loadOperations = useOperationsDataStore((state) => state.loadOperations);
    const tickets = supportTickets.filter((ticket) => ticket.channel === "warehouse");
    const pushToast = useFeedbackStore((state) => state.pushToast);
    const [subject, setSubject] = useState("Cần bổ sung nhân sự ca tối");
    const [message, setMessage] = useState("Khối lượng picking tăng nhanh, đề nghị điều phối thêm nhân sự cho ca 18h.");
    useEffect(() => {
        void loadOperations();
    }, [loadOperations]);
    return (<div className="space-y-8">
            <AdminPageHeader title="Hỗ trợ kho" description="Gửi yêu cầu hỗ trợ nội bộ và theo dõi ticket vận hành kho."/>

            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <SurfaceCard className="space-y-4">
                    <label className="block space-y-2 text-sm">
                        <span className="font-medium">Chủ đề</span>
                        <input className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" value={subject} onChange={(event) => setSubject(event.target.value)}/>
                    </label>
                    <label className="block space-y-2 text-sm">
                        <span className="font-medium">Nội dung</span>
                        <textarea className="min-h-36 w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" value={message} onChange={(event) => setMessage(event.target.value)}/>
                    </label>
                    <Button onClick={() => {
            void createSupportTicket({
                subject,
                message,
                channel: "warehouse",
            });
            pushToast({
                tone: "success",
                message: "Đã tạo ticket hỗ trợ kho vận.",
            });
        }}>
                        Gửi ticket
                    </Button>
                </SurfaceCard>

                <SurfaceCard tone="low" className="space-y-4">
                    <h3 className="font-headline text-2xl font-bold">Danh sách ticket</h3>
                    {tickets.length === 0 ? (<p className="text-sm text-on-surface-variant">
                            Chưa có ticket nào cho kho vận.
                        </p>) : (tickets.map((ticket) => (<div key={ticket.id} className="rounded-3xl bg-surface-container-lowest p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs uppercase tracking-widest text-primary">
                                            {ticket.id}
                                        </p>
                                        <p className="mt-2 font-semibold">{ticket.subject}</p>
                                    </div>
                                    <button className="text-sm font-medium text-primary hover:underline" onClick={() => void resolveSupportTicket(ticket.id)}>
                                        Đánh dấu đã xử lý
                                    </button>
                                </div>
                                <p className="mt-2 text-sm text-on-surface-variant">
                                    {ticket.message}
                                </p>
                            </div>)))}
                </SurfaceCard>
            </div>
        </div>);
}
