import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { routes } from "@/shared/config/routes";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { useFeedbackStore } from "@/shared/lib/store/use-feedback-store";
import { usePostStore } from "@/shared/lib/store/use-post-store";
import { Badge, Button, ButtonLink, Icon, SurfaceCard } from "@/shared/ui";
function formatPostDate(value) {
    if (!value)
        return "Chưa xuất bản";
    return new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(new Date(value));
}
function paragraphLines(body) {
    return body
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);
}
export function StoryPage() {
    const navigate = useNavigate();
    const posts = usePostStore((state) => state.posts);
    const likedPostIds = usePostStore((state) => state.likedPostIds);
    const status = usePostStore((state) => state.status);
    const error = usePostStore((state) => state.error);
    const isSaving = usePostStore((state) => state.isSaving);
    const loadPosts = usePostStore((state) => state.loadPosts);
    const toggleLike = usePostStore((state) => state.toggleLike);
    const addComment = usePostStore((state) => state.addComment);
    const session = useAuthStore((state) => state.session);
    const authSource = useAuthStore((state) => state.authSource);
    const accessToken = useAuthStore((state) => state.accessToken);
    const pushToast = useFeedbackStore((state) => state.pushToast);
    const [commentDrafts, setCommentDrafts] = useState({});
    const canInteract = Boolean(accessToken && authSource === "backend" && session?.user.role === "customer");
    useEffect(() => {
        void loadPosts();
    }, [loadPosts]);
    async function handleToggleLike(post) {
        if (!canInteract) {
            pushToast({
                tone: "warning",
                message: "Vui lòng đăng nhập tài khoản khách hàng để thích bài viết.",
            });
            void navigate(routes.login);
            return;
        }
        const result = await toggleLike(post.id);
        if (!result.success) {
            pushToast({ tone: "warning", message: result.error ?? "Không thể cập nhật lượt thích." });
        }
    }
    async function handleSubmitComment(post) {
        const content = (commentDrafts[post.id] ?? "").trim();
        if (!canInteract) {
            pushToast({
                tone: "warning",
                message: "Vui lòng đăng nhập tài khoản khách hàng để bình luận.",
            });
            void navigate(routes.login);
            return;
        }
        if (content.length < 2) {
            pushToast({ tone: "warning", message: "Bình luận cần có ít nhất 2 ký tự." });
            return;
        }
        const result = await addComment(post.id, content);
        if (!result.success) {
            pushToast({ tone: "warning", message: result.error ?? "Không thể gửi bình luận." });
            return;
        }
        setCommentDrafts((current) => ({ ...current, [post.id]: "" }));
        pushToast({ tone: "success", message: "Đã gửi bình luận." });
    }
    return (<div className="mx-auto max-w-5xl px-6 pb-12 pt-24">
            <section className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <Badge tone="primary">Cộng đồng Heritage Harvest</Badge>
                    <h1 className="mt-4 font-headline text-3xl font-bold tracking-tight text-on-surface md:text-4xl">
                        Bài viết từ đội ngũ quản trị
                    </h1>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-on-surface-variant">
                        Cập nhật câu chuyện vùng nguyên liệu, mùa vụ và những ghi chú vận hành từ
                        Heritage Harvest. Khách hàng có thể thả thích và bình luận sau khi đăng nhập.
                    </p>
                </div>
                {!canInteract ? (<ButtonLink to={routes.login} variant="secondary">
                        Đăng nhập để tương tác
                    </ButtonLink>) : null}
            </section>

            {status === "loading" ? (<SurfaceCard className="text-sm text-on-surface-variant">
                    Đang tải bài viết...
                </SurfaceCard>) : null}

            {status === "error" ? (<SurfaceCard className="text-sm text-error">
                    {error ?? "Không thể tải bài viết."}
                </SurfaceCard>) : null}

            {status === "ready" && posts.length === 0 ? (<SurfaceCard className="text-sm text-on-surface-variant">
                    Chưa có bài viết được xuất bản.
                </SurfaceCard>) : null}

            <div className="space-y-6">
                {posts.map((post) => {
            const isLiked = likedPostIds.includes(post.id);
            const draft = commentDrafts[post.id] ?? "";
            return (<SurfaceCard key={post.id} className="overflow-hidden p-0">
                            {post.cover_image_url ? (<img src={post.cover_image_url} alt={post.title} className="h-64 w-full object-cover"/>) : (<div className="flex h-44 w-full items-center justify-center bg-surface-container-low text-primary">
                                    <Icon name="article" className="text-5xl"/>
                                </div>)}

                            <div className="space-y-6 p-6">
                                <header>
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
                                        <Badge tone="secondary">Đã xuất bản</Badge>
                                        <span>{formatPostDate(post.published_at)}</span>
                                        <span>{post.author?.full_name ?? "Admin"}</span>
                                    </div>
                                    <h2 className="mt-3 font-headline text-2xl font-bold text-on-surface">
                                        {post.title}
                                    </h2>
                                    {post.excerpt ? (<p className="mt-3 text-sm leading-6 text-on-surface-variant">
                                            {post.excerpt}
                                        </p>) : null}
                                </header>

                                <div className="space-y-3 text-sm leading-7 text-on-surface">
                                    {paragraphLines(post.body).map((line) => (<p key={line}>{line}</p>))}
                                </div>

                                <div className="flex flex-wrap items-center gap-3 border-y border-outline-variant/15 py-4">
                                    <Button variant={isLiked ? "primary" : "secondary"} size="sm" iconLeft={<Icon name="favorite" fill={isLiked}/>} disabled={isSaving} onClick={() => void handleToggleLike(post)}>
                                        {post.likes_count} thích
                                    </Button>
                                    <span className="text-sm text-on-surface-variant">
                                        {post.comments_count} bình luận
                                    </span>
                                </div>

                                <section className="space-y-4">
                                    <div className="space-y-3">
                                        {post.comments.length === 0 ? (<p className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                                                Chưa có bình luận nào.
                                            </p>) : (post.comments.map((comment) => (<div key={comment.id} className="rounded-2xl bg-surface-container-low p-4">
                                                    <div className="flex items-center justify-between gap-3 text-xs text-on-surface-variant">
                                                        <span className="font-semibold text-on-surface">
                                                            {comment.author?.full_name ?? "Khách hàng"}
                                                        </span>
                                                        <span>{formatPostDate(comment.created_at)}</span>
                                                    </div>
                                                    <p className="mt-2 text-sm leading-6 text-on-surface">
                                                        {comment.content}
                                                    </p>
                                                </div>)))}
                                    </div>

                                    {canInteract ? (<div className="space-y-3">
                                            <textarea className="min-h-24 w-full rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15" placeholder="Viết bình luận..." value={draft} onChange={(event) => setCommentDrafts((current) => ({
                        ...current,
                        [post.id]: event.target.value,
                    }))}/>
                                            <div className="flex justify-end">
                                                <Button disabled={isSaving || draft.trim().length < 2} onClick={() => void handleSubmitComment(post)}>
                                                    Gửi bình luận
                                                </Button>
                                            </div>
                                        </div>) : (<div className="flex flex-col gap-3 rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant sm:flex-row sm:items-center sm:justify-between">
                                            <span>Đăng nhập bằng tài khoản khách hàng để bình luận.</span>
                                            <ButtonLink to={routes.login} size="sm">
                                                Đăng nhập
                                            </ButtonLink>
                                        </div>)}
                                </section>
                            </div>
                        </SurfaceCard>);
        })}
            </div>
        </div>);
}
