import { create } from "zustand";
import { apiRequest, isUnauthorizedApiError } from "@/shared/api/backend-client";
import { registerProtectedSessionCleanup } from "@/shared/lib/store/protected-session";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
const initialState = {
    posts: [],
    likedPostIds: [],
    adminPosts: [],
    status: "idle",
    adminStatus: "idle",
    error: null,
    adminError: null,
    isSaving: false,
};
const SESSION_EXPIRED_MESSAGE = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
function token() {
    return useAuthStore.getState().accessToken;
}
function isBackendCustomer() {
    const authState = useAuthStore.getState();
    return authState.authSource === "backend" && authState.session?.user.role === "customer";
}
// Store này quản lý 2 "thế giới" song song: `posts` (công khai, ai cũng xem được, khách
// hàng like/bình luận) và `adminPosts` (đầy đủ mọi bài kể cả DRAFT, dùng cho trang quản
// trị) — nhiều action dưới đây cập nhật CẢ HAI để giữ đồng bộ khi 1 thao tác ảnh hưởng tới
// cả 2 danh sách (vd publish 1 bài DRAFT thì nó phải xuất hiện thêm ở `posts`).
function replacePost(posts, nextPost) {
    return posts.map((post) => (post.id === nextPost.id ? nextPost : post));
}
// Khi admin ẩn 1 bình luận (status HIDDEN), phải gỡ nó khỏi mảng comments lồng trong
// `posts` (view công khai) dù server đã xử lý xong — feed công khai không tự refetch.
function removeCommentFromPublicPosts(posts, comment) {
    return posts.map((post) => {
        if (post.id !== comment.post_id)
            return post;
        const hadComment = post.comments.some((item) => item.id === comment.id);
        return {
            ...post,
            comments: post.comments.filter((item) => item.id !== comment.id),
            comments_count: hadComment && post.comments_count > 0 ? post.comments_count - 1 : post.comments_count,
        };
    });
}
export const usePostStore = create()((set, get) => ({
    ...initialState,
    loadPosts: async (force = false) => {
        if (!force && get().status === "ready") {
            return { success: true };
        }
        set({ status: "loading", error: null });
        try {
            const response = await apiRequest("/posts");
            set({
                posts: response.data,
                status: "ready",
                error: null,
            });
            if (isBackendCustomer()) {
                await get().loadMyLikes();
            }
            else {
                set({ likedPostIds: [] });
            }
            return { success: true };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Không thể tải bài viết.";
            set({ status: "error", error: message });
            return { success: false, error: message };
        }
    },
    loadMyLikes: async () => {
        const accessToken = token();
        if (!accessToken || !isBackendCustomer()) {
            set({ likedPostIds: [] });
            return { success: true, data: [] };
        }
        try {
            const response = await apiRequest("/posts/my-likes", {
                token: accessToken,
            });
            set({ likedPostIds: response.data.post_ids });
            return { success: true, data: response.data.post_ids };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể tải lượt thích.";
            return { success: false, error: message };
        }
    },
    toggleLike: async (postId) => {
        const accessToken = token();
        if (!accessToken || !isBackendCustomer()) {
            return { success: false, error: "Bạn cần đăng nhập tài khoản khách hàng để thích bài viết." };
        }
        const liked = get().likedPostIds.includes(postId);
        set({ isSaving: true });
        try {
            const response = await apiRequest(`/posts/${postId}/likes`, {
                method: liked ? "DELETE" : "POST",
                token: accessToken,
            });
            set((state) => ({
                posts: state.posts.map((post) => post.id === postId
                    ? { ...post, likes_count: response.data.likes_count }
                    : post),
                adminPosts: state.adminPosts.map((post) => post.id === postId
                    ? { ...post, likes_count: response.data.likes_count }
                    : post),
                likedPostIds: response.data.liked
                    ? Array.from(new Set([...state.likedPostIds, postId]))
                    : state.likedPostIds.filter((id) => id !== postId),
                isSaving: false,
            }));
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể cập nhật lượt thích.";
            set({ isSaving: false });
            return { success: false, error: message };
        }
    },
    addComment: async (postId, content) => {
        const accessToken = token();
        if (!accessToken || !isBackendCustomer()) {
            return { success: false, error: "Bạn cần đăng nhập tài khoản khách hàng để bình luận." };
        }
        set({ isSaving: true });
        try {
            const response = await apiRequest(`/posts/${postId}/comments`, {
                method: "POST",
                token: accessToken,
                body: { content },
            });
            set((state) => ({
                posts: state.posts.map((post) => post.id === postId
                    ? {
                        ...post,
                        comments: [response.data, ...post.comments],
                        comments_count: response.meta?.comments_count ?? post.comments_count + 1,
                    }
                    : post),
                isSaving: false,
            }));
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể gửi bình luận.";
            set({ isSaving: false });
            return { success: false, error: message };
        }
    },
    loadAdminPosts: async () => {
        const accessToken = token();
        if (!accessToken) {
            return { success: false, error: "Bạn cần đăng nhập admin để tải bài viết." };
        }
        set({ adminStatus: "loading", adminError: null });
        try {
            const response = await apiRequest("/admin/posts", {
                token: accessToken,
            });
            set({
                adminPosts: response.data,
                adminStatus: "ready",
                adminError: null,
            });
            return { success: true };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể tải bài viết admin.";
            set({ adminStatus: "error", adminError: message });
            return { success: false, error: message };
        }
    },
    createPost: async (payload) => {
        const accessToken = token();
        if (!accessToken)
            return { success: false, error: "Bạn cần đăng nhập admin để tạo bài viết." };
        set({ isSaving: true, adminError: null });
        try {
            const response = await apiRequest("/admin/posts", {
                method: "POST",
                token: accessToken,
                body: payload,
            });
            set((state) => ({
                adminPosts: [response.data, ...state.adminPosts],
                posts: response.data.status === "PUBLISHED"
                    ? [response.data, ...state.posts]
                    : state.posts,
                isSaving: false,
            }));
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể tạo bài viết.";
            set({ isSaving: false, adminError: message });
            return { success: false, error: message };
        }
    },
    updatePost: async (postId, payload) => {
        const accessToken = token();
        if (!accessToken)
            return { success: false, error: "Bạn cần đăng nhập admin để cập nhật bài viết." };
        set({ isSaving: true, adminError: null });
        try {
            const response = await apiRequest(`/admin/posts/${postId}`, {
                method: "PUT",
                token: accessToken,
                body: payload,
            });
            set((state) => ({
                adminPosts: replacePost(state.adminPosts, response.data),
                posts: response.data.status === "PUBLISHED"
                    ? state.posts.some((post) => post.id === postId)
                        ? replacePost(state.posts, response.data)
                        : [response.data, ...state.posts]
                    : state.posts.filter((post) => post.id !== postId),
                isSaving: false,
            }));
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể cập nhật bài viết.";
            set({ isSaving: false, adminError: message });
            return { success: false, error: message };
        }
    },
    deletePost: async (postId) => {
        const accessToken = token();
        if (!accessToken)
            return { success: false, error: "Bạn cần đăng nhập admin để xóa bài viết." };
        set({ isSaving: true, adminError: null });
        try {
            await apiRequest(`/admin/posts/${postId}`, {
                method: "DELETE",
                token: accessToken,
            });
            set((state) => ({
                adminPosts: state.adminPosts.filter((post) => post.id !== postId),
                posts: state.posts.filter((post) => post.id !== postId),
                likedPostIds: state.likedPostIds.filter((id) => id !== postId),
                isSaving: false,
            }));
            return { success: true };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể xóa bài viết.";
            set({ isSaving: false, adminError: message });
            return { success: false, error: message };
        }
    },
    updateCommentVisibility: async (commentId, status) => {
        const accessToken = token();
        if (!accessToken)
            return { success: false, error: "Bạn cần đăng nhập admin để quản lý bình luận." };
        set({ isSaving: true, adminError: null });
        try {
            const response = await apiRequest(`/admin/posts/comments/${commentId}/visibility`, {
                method: "PATCH",
                token: accessToken,
                body: { status },
            });
            set((state) => ({
                adminPosts: state.adminPosts.map((post) => post.id === response.data.post_id
                    ? {
                        ...post,
                        comments: post.comments.map((comment) => comment.id === commentId ? response.data : comment),
                    }
                    : post),
                posts: response.data.status === "HIDDEN"
                    ? removeCommentFromPublicPosts(state.posts, response.data)
                    : state.posts,
                isSaving: false,
            }));
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể cập nhật bình luận.";
            set({ isSaving: false, adminError: message });
            return { success: false, error: message };
        }
    },
    reset: () => set(initialState),
}));
registerProtectedSessionCleanup(() => {
    usePostStore.getState().reset();
});
