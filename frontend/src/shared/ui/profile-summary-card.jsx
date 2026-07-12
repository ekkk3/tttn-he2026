import { cn } from "@/shared/lib/cn";
import { Icon } from "@/shared/ui/icon";
import { SurfaceCard } from "@/shared/ui/surface-card";
export function ProfileSummaryCard({ profile, rewards, className }) {
    const progress = Math.min(100, Math.round((rewards.points / rewards.nextTierPoints) * 100));
    return (<SurfaceCard className={cn("space-y-6", className)}>
            <div className="flex items-center gap-4">
                <img src={profile.avatar} alt={profile.name} className="h-16 w-16 rounded-full object-cover ring-2 ring-primary/15"/>
                <div>
                    <h2 className="font-headline text-xl font-bold text-on-surface">
                        {profile.name}
                    </h2>
                    <p className="text-sm text-on-surface-variant">{profile.email}</p>
                </div>
            </div>

            <div className="rounded-3xl bg-surface-container-low p-5">
                <div className="mb-3 flex items-center gap-2">
                    <Icon name="diamond" className="text-primary" fill/>
                    <h3 className="font-headline text-lg font-bold">{rewards.tier}</h3>
                </div>
                <div className="mb-3 flex items-center justify-between text-sm">
                    <span className="text-on-surface-variant">Điểm hiện tại</span>
                    <span className="font-semibold text-on-surface">{rewards.points}</span>
                </div>
                <div className="h-2 rounded-full bg-surface-container-high">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }}/>
                </div>
                <p className="mt-3 text-xs uppercase tracking-widest text-on-surface-variant">
                    Còn {rewards.nextTierPoints - rewards.points} điểm để lên hạng tiếp theo
                </p>
            </div>

            <div className="space-y-3">
                {rewards.perks.map((perk) => (<div key={perk} className="flex items-start gap-3 text-sm text-on-surface-variant">
                        <Icon name="check_circle" className="mt-0.5 text-primary" fill/>
                        <span>{perk}</span>
                    </div>))}
            </div>
        </SurfaceCard>);
}
