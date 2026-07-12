import { Link } from "react-router-dom";
import { routes } from "@/shared/config/routes";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { ButtonLink, SurfaceCard } from "@/shared/ui";
export function UnauthorizedPage() {
    const session = useAuthStore((state) => state.session);
    return (<div className="mx-auto flex min-h-[calc(100vh-9rem)] max-w-4xl items-center px-6 py-24">
            <SurfaceCard className="w-full space-y-6 text-center">
                <p className="text-xs uppercase tracking-widest text-error">
                    Không đúng quyền truy cập
                </p>
                <h1 className="font-headline text-4xl font-bold">
                    Bạn đang ở sai khu vực của hệ thống
                </h1>
                <p className="mx-auto max-w-2xl text-sm leading-7 text-on-surface-variant">
                    {session
            ? `Tài khoản hiện tại thuộc vai trò ${session.user.role}, nên không thể mở route này.`
            : "Bạn cần đăng nhập bằng tài khoản phù hợp để tiếp tục."}
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                    <ButtonLink to={routes.login}>Về trang đăng nhập</ButtonLink>
                    <ButtonLink to={routes.home} variant="secondary">
                        Về storefront
                    </ButtonLink>
                </div>
                {session ? (<Link className="text-sm font-medium text-primary hover:underline" to={routes.logout}>
                        Đăng xuất để đổi tài khoản
                    </Link>) : null}
            </SurfaceCard>
        </div>);
}
