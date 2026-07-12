import { fulfillmentStatusLabels, shippingTierLabels } from "@/shared/lib/labels";
import { Badge, Icon, SurfaceCard, cn } from "@/shared/ui";
function statusTone(status) {
    if (status === "shipped")
        return "success";
    if (status === "awaiting_pickup")
        return "warning";
    return "primary";
}
export function FulfillmentQueue({ tasks, selectedTaskId, onSelectTask }) {
    return (<div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
            <SurfaceCard className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h3 className="font-headline text-2xl font-bold text-on-surface">
                            Hàng đợi xử lý đang hoạt động
                        </h3>
                        <p className="text-sm text-on-surface-variant">
                            Ưu tiên đơn gấp nhưng vẫn giữ nhịp xử lý đều cho luồng tiêu chuẩn.
                        </p>
                    </div>
                    <Badge tone="primary">{tasks.length} nhiệm vụ trực tiếp</Badge>
                </div>

                <div className="space-y-3">
                    {tasks.map((task) => {
            const selected = task.id === selectedTaskId;
            return (<button key={task.id} className={cn("flex w-full flex-col gap-4 rounded-3xl border border-transparent bg-surface-container-low p-5 text-left transition hover:bg-surface-container", selected && "border-primary/20 bg-primary/5")} onClick={() => onSelectTask?.(task.id)}>
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div>
                                        <p className="text-xs uppercase tracking-widest text-on-surface-variant">
                                            {task.orderId}
                                        </p>
                                        <h4 className="font-headline text-xl font-semibold text-on-surface">
                                            {task.customerName}
                                        </h4>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Badge tone={task.priority === "rush" ? "danger" : "neutral"}>
                                            {task.priority === "rush" ? "Gấp" : "Tiêu chuẩn"}
                                        </Badge>
                                        <Badge tone={statusTone(task.status)}>
                                            {fulfillmentStatusLabels[task.status]}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="grid gap-3 text-sm text-on-surface-variant sm:grid-cols-3">
                                    <div className="flex items-center gap-2">
                                        <Icon name="deployed_code_history" className="text-primary"/>
                                        <span>{task.assignedZone}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Icon name="schedule" className="text-primary"/>
                                        <span>{task.etaLabel}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Icon name="local_shipping" className="text-primary"/>
                                        <span>{shippingTierLabels[task.shippingTier]}</span>
                                    </div>
                                </div>
                            </button>);
        })}
                </div>
            </SurfaceCard>

            <SurfaceCard tone="low" className="space-y-4">
                <h3 className="font-headline text-lg font-bold text-on-surface">
                    Luồng hoàn tất đơn trực tiếp
                </h3>
                <div className="space-y-3">
                    {tasks.map((task) => (<div key={`${task.id}-stream`} className="rounded-2xl bg-surface-container-lowest p-4">
                            <div className="mb-2 flex items-center justify-between">
                                <p className="font-semibold text-on-surface">{task.orderId}</p>
                                <Badge tone={statusTone(task.status)}>
                                    {fulfillmentStatusLabels[task.status]}
                                </Badge>
                            </div>
                            <p className="text-sm text-on-surface-variant">
                                {task.customerName} · {task.assignedZone}
                            </p>
                        </div>))}
                </div>
            </SurfaceCard>
        </div>);
}
