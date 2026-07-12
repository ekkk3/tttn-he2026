import { useEffect } from "react";
import { useAccountStore } from "@/shared/lib/store/use-account-store";
import { useFeedbackStore } from "@/shared/lib/store/use-feedback-store";
import { Button, SurfaceCard } from "@/shared/ui";
const redemptionOptions = [
    { title: "Miễn phí vận chuyển đơn kế tiếp", points: 300 },
    { title: "Giảm 10% cho curated box", points: 600 },
    { title: "Quà mẫu theo mùa", points: 900 },
];
export function AccountRewardsPage() {
    const rewardSnapshot = useAccountStore((state) => state.rewardSnapshot);
    const history = useAccountStore((state) => state.profile.rewardHistory);
    const redeemReward = useAccountStore((state) => state.redeemReward);
    const loadProfile = useAccountStore((state) => state.loadProfile);
    const isSaving = useAccountStore((state) => state.isSaving);
    const pushToast = useFeedbackStore((state) => state.pushToast);
    useEffect(() => {
        void loadProfile();
    }, [loadProfile]);
    return (<div className="mx-auto max-w-6xl px-6 pb-16 pt-24">
            <div className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
                <SurfaceCard className="space-y-5">
                    <p className="text-xs uppercase tracking-widest text-primary">
                        Điểm thưởng hiện tại
                    </p>
                    <h1 className="font-headline text-5xl font-bold">{rewardSnapshot.points}</h1>
                    <p className="text-on-surface-variant">
                        Hạng {rewardSnapshot.tier || "Chưa xác định"}. Còn{" "}
                        {Math.max(0, rewardSnapshot.nextTierPoints - rewardSnapshot.points)} điểm để chạm
                        mốc tiếp theo.
                    </p>
                    <div className="space-y-3">
                        {rewardSnapshot.perks.map((perk) => (<div key={perk} className="rounded-3xl bg-surface-container-low p-4 text-sm">
                                {perk}
                            </div>))}
                    </div>
                </SurfaceCard>

                <div className="space-y-8">
                    <SurfaceCard tone="low" className="space-y-4">
                        <h2 className="font-headline text-2xl font-bold">Đổi quà ngay trong app</h2>
                        <div className="grid gap-4 md:grid-cols-3">
                            {redemptionOptions.map((option) => (<div key={option.title} className="rounded-3xl bg-surface-container-lowest p-5">
                                    <p className="font-semibold">{option.title}</p>
                                    <p className="mt-2 text-sm text-on-surface-variant">
                                        {option.points} điểm
                                    </p>
                                    <Button className="mt-4 w-full" size="sm" disabled={isSaving} onClick={async () => {
                const result = await redeemReward(option.title, option.points);
                pushToast({
                    tone: result.success ? "success" : "warning",
                    message: result.success
                        ? `Đã đổi ưu đãi: ${option.title}.`
                        : (result.error ?? "Không thể đổi ưu đãi."),
                });
            }}>
                                        Đổi quà
                                    </Button>
                                </div>))}
                        </div>
                    </SurfaceCard>

                    <SurfaceCard className="space-y-4">
                        <h2 className="font-headline text-2xl font-bold">Lịch sử đổi thưởng</h2>
                        {history.length === 0 ? (<p className="text-sm text-on-surface-variant">
                                Chưa có lượt đổi thưởng nào. Hãy bắt đầu từ một trong các ưu đãi phía trên.
                            </p>) : (<div className="space-y-3">
                                {history.map((item) => (<div key={item.id} className="rounded-3xl bg-surface-container-low p-4">
                                        <p className="font-semibold">{item.title}</p>
                                        <p className="mt-1 text-sm text-on-surface-variant">
                                            {item.pointsUsed} điểm ·{" "}
                                            {new Date(item.createdAt).toLocaleDateString("vi-VN")}
                                        </p>
                                    </div>))}
                            </div>)}
                    </SurfaceCard>
                </div>
            </div>
        </div>);
}
