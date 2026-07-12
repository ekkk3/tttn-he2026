# CODEX.md

## Mục tiêu

Tài liệu này hướng dẫn Codex lập kế hoạch và triển khai giao diện từ Figma với độ chính xác cao, đồng thời tuân thủ kiến trúc lai giữa **AD (Atomic Design)** và **FSD (Feature-Sliced Design)**.

Ưu tiên theo thứ tự:

1. **Đúng giao diện theo Figma**
2. **Đúng kiến trúc repo**
3. **Tái sử dụng component và token**
4. **Code dễ mở rộng, dễ bảo trì**

---

## Nguyên tắc cốt lõi

- Không được nhảy vào code ngay. **Luôn lập plan trước**.
- Không tự sáng tạo lại thiết kế nếu Figma đã thể hiện rõ.
- Không tạo design language mới nếu repo đã có token và component sẵn.
- Mọi quyết định khác với Figma phải được ghi rõ dưới dạng **assumption**.
- Ưu tiên dùng lại:
    - design tokens
    - layout primitives
    - base UI components
    - icon system
    - responsive rules hiện có trong repo
- Mọi UI mới phải bám theo **kiến trúc lai AD + FSD** mô tả bên dưới.

---

## Cách hiểu kiến trúc lai AD + FSD

### 1. Atomic Design dùng để chia cấp UI

Dùng Atomic Design để xác định độ hạt của UI:

- **Atoms**: button, input, checkbox, icon, badge, text, spinner
- **Molecules**: search box, filter item, price block, pagination item, product meta
- **Organisms**: product card, filter sidebar, navbar, footer section
- **Templates**: page layout chưa gắn dữ liệu thật
- **Pages**: màn hình hoàn chỉnh gắn dữ liệu thật

### 2. FSD dùng để tổ chức folder và ownership

Dùng FSD để quyết định nơi đặt code:

- `app/`: app bootstrap, providers, router, global styles
- `pages/`: page-level composition
- `widgets/`: khối UI lớn ghép từ entities/features/shared
- `features/`: hành vi người dùng có ý nghĩa nghiệp vụ
- `entities/`: business entities như product, category, order, user
- `shared/`: design system, helpers, api client, config, constants

### 3. Quy tắc lai

- **Atomic Design trả lời câu hỏi “component này thuộc cấp UI nào?”**
- **FSD trả lời câu hỏi “component này nên nằm ở folder nào?”**

Ví dụ:

- `Button` là **atom**, và nên nằm ở `shared/ui/button`
- `ProductCard` là **organism**, nhưng vì gắn với entity product nên nên nằm ở `entities/product/ui/product-card`
- `CatalogFilterSidebar` là **organism**, nhưng vì là khối ghép lớn cho page nên có thể nằm ở `widgets/catalog-filters`
- `ToggleWishlist` là hành vi người dùng, nên nằm ở `features/toggle-wishlist`

---

## Cấu trúc thư mục khuyến nghị

```txt
src/
  app/
    providers/
    router/
    styles/
    index.tsx

  pages/
    product-catalog/
      ui/
        product-catalog-page.tsx
      model/
      index.ts

  widgets/
    header/
      ui/
      index.ts
    footer/
      ui/
      index.ts
    catalog-filters/
      ui/
      model/
      index.ts
    catalog-toolbar/
      ui/
      index.ts
    product-grid/
      ui/
      index.ts
    pagination/
      ui/
      index.ts

  features/
    search-products/
      ui/
      model/
      index.ts
    filter-products/
      ui/
      model/
      index.ts
    sort-products/
      ui/
      model/
      index.ts
    add-to-cart/
      ui/
      model/
      index.ts
    toggle-view-mode/
      ui/
      model/
      index.ts

  entities/
    product/
      ui/
        product-card/
        product-price/
        product-badge/
      model/
      lib/
      api/
      index.ts
    category/
      ui/
      model/
      index.ts
    region/
      ui/
      model/
      index.ts

  shared/
    ui/
      button/
      input/
      checkbox/
      select/
      badge/
      icon/
      text/
      image/
      container/
      stack/
      grid/
      divider/
      pagination-item/
    lib/
    api/
    config/
    const/
    assets/
    styles/
    tokens/
```

---

## Quy tắc phân chia folder

### shared

Đặt ở `shared/` nếu:

- không gắn domain cụ thể
- tái sử dụng ở nhiều nơi
- không mang logic nghiệp vụ đặc thù

Ví dụ:

- button
- input
- icon
- modal base
- typography helpers
- spacing/layout primitives

### entities

Đặt ở `entities/` nếu:

- gắn với một domain object rõ ràng
- có model, type, api hoặc UI riêng của entity

Ví dụ:

- product card
- product price
- product badge
- category chip

### features

Đặt ở `features/` nếu:

- đại diện cho một user action hoặc business interaction
- có state hoặc model phục vụ một hành vi cụ thể

Ví dụ:

- lọc sản phẩm
- sắp xếp sản phẩm
- thêm vào giỏ
- chuyển grid/list view

### widgets

Đặt ở `widgets/` nếu:

- là khối UI lớn
- ghép nhiều entities/features/shared
- có thể tái dùng ở 1 số page nhưng không đủ generic để vào shared

Ví dụ:

- top navigation
- filter sidebar
- catalog toolbar
- footer
- product grid section

### pages

Đặt ở `pages/` nếu:

- là entry của 1 màn hình hoàn chỉnh
- chịu trách nhiệm compose widgets/features/entities
- không chứa quá nhiều chi tiết UI nhỏ

---

## Quy trình bắt buộc trước khi code

Codex phải thực hiện lần lượt:

### Bước 1: Đọc đầu vào

Nguồn đầu vào có thể gồm:

- link Figma frame
- screenshot
- mô tả nghiệp vụ
- codebase hiện có

Codex phải tóm tắt:

- đây là màn hình gì
- mục tiêu người dùng là gì
- các section chính
- các thành phần lặp lại
- trạng thái tương tác nhìn thấy được
- responsive intent nếu suy ra được

### Bước 2: Audit codebase

Trước khi đề xuất tạo file mới, phải tìm:

1. Design tokens
    - màu
    - typography
    - spacing
    - radius
    - shadow
    - breakpoints

2. Shared UI
    - button
    - input
    - checkbox
    - select
    - icon
    - card
    - container
    - stack/grid

3. Existing entities/features/widgets tương tự

4. Styling system
    - CSS Modules / SCSS / Tailwind / styled-components
    - naming conventions
    - responsive conventions

5. Routing/data conventions
    - cách page được mount
    - cách state/query params được quản lý
    - cách mock data hoặc API data được tổ chức

### Bước 3: Lập plan trước

Trước khi viết code, phải xuất plan có cấu trúc ở phần bên dưới.

### Bước 4: Chỉ sau khi plan rõ ràng mới code

---

## Output format bắt buộc cho phần plan

Khi được yêu cầu triển khai UI từ Figma, Codex phải trả plan theo đúng format này:

```md
## 1. Screen summary

- Màn hình là gì
- Mục tiêu chính của người dùng
- Các khu vực chính của trang

## 2. Visual breakdown

- Header
- Breadcrumb
- Sidebar filters
- Main content
- Product grid
- Pagination
- Footer
- Các trạng thái hover/active/selected nếu thấy được

## 3. Component hierarchy

- Page
- Widgets
- Features
- Entities
- Shared atoms/molecules

## 4. Figma to architecture mapping

- Layer/section nào map vào pages
- Layer/section nào map vào widgets
- Phần nào là features
- Phần nào là entities
- Phần nào là shared UI

## 5. Token mapping

- Colors
- Typography
- Spacing
- Radius
- Shadow
- Border
- Breakpoints

## 6. File changes

- File nào tạo mới
- File nào sửa
- Lý do

## 7. Data and state plan

- Data model nào cần
- Props nào cần
- Query params/filter state nào cần
- UI state nào cần

## 8. Responsive plan

- Desktop
- Tablet
- Mobile
- Các điểm gãy chính
- Grid thay đổi như thế nào
- Sidebar/filter collapse ra sao

## 9. Risks and assumptions

- Chi tiết nào chưa rõ từ Figma
- Chỗ nào cần giả định
- Chỗ nào cần xác nhận

## 10. Execution steps

- Thứ tự implement
- Ưu tiên từng phần
```

---

## Quy tắc map từ Figma sang code

### 1. Không map 1 layer = 1 component một cách máy móc

Phải nhóm theo ý nghĩa UI và nghiệp vụ.

Ví dụ:

- 1 card sản phẩm có nhiều layer ảnh, text, badge, button
- Không tạo mỗi layer thành 1 component riêng
- Phải nhóm thành `ProductCard`

### 2. Chỉ tách component khi có lý do rõ ràng

Tách nếu:

- tái sử dụng
- có logic riêng
- có state riêng
- giúp code dễ đọc hơn

Không tách nếu chỉ làm tăng độ phân mảnh mà không có lợi ích.

### 3. Ưu tiên reuse hơn tạo mới

Thứ tự ưu tiên:

1. dùng component sẵn có
2. mở rộng component sẵn có
3. tạo component mới

### 4. Dùng token thay vì hardcode

Không hardcode nếu repo đã có token cho:

- color
- spacing
- radius
- typography
- shadow
- z-index
- breakpoints

### 5. Khoảng cách và căn chỉnh

Phải giữ:

- nhịp spacing tổng thể
- alignment theo trục
- grouping của UI
- hierarchy thị giác

Không nhất thiết pixel-perfect tuyệt đối, nhưng phải **fidelity cao**.

---

## Quy tắc cho responsive

Codex phải suy nghĩ responsive ngay từ lúc plan, không để sau.

### Bắt buộc mô tả:

- số cột grid desktop/tablet/mobile
- sidebar giữ cố định hay collapse
- toolbar xuống dòng thế nào
- pagination co giãn ra sao
- footer chuyển cột thế nào

### Quy tắc thực thi:

- ưu tiên layout primitives hoặc grid system hiện có
- không dùng breakpoint tùy hứng nếu repo đã có chuẩn
- nếu Figma chỉ có desktop, phải ghi assumption rõ cho tablet/mobile

---

## Quy tắc cho styling

Codex phải dùng đúng styling approach đang có trong repo.
Không tự đổi framework styling.

### Nếu repo dùng Tailwind

- ưu tiên class utilities theo convention sẵn có
- gom class phức tạp thành reusable component nếu lặp nhiều
- dùng token/config có sẵn

### Nếu repo dùng CSS Modules/SCSS

- tạo module theo từng component/page phù hợp
- tránh selector lồng quá sâu
- dùng variables/mixins/tokens sẵn có

### Nếu repo dùng styled-components

- tái sử dụng primitives
- tránh tạo styled component trùng lặp chỉ khác vài props
- đưa token vào theme

---

## Quy tắc cho naming

### Tên file

- kebab-case cho folder/file
- ví dụ:
    - `product-card.tsx`
    - `catalog-filter-sidebar.tsx`

### Tên component

- PascalCase
- ví dụ:
    - `ProductCard`
    - `CatalogToolbar`

### Tên hook/model

- rõ mục đích
- ví dụ:
    - `useCatalogFilters`
    - `useProductSort`

### Tên folder theo FSD

- đặt theo domain hoặc intent
- không đặt tên mơ hồ như `common2`, `misc`, `stuff`

---

## Quy tắc cho dữ liệu giả lập

Nếu chưa có API thật:

- mock data phải đặt gần entity hoặc feature phù hợp
- không nhét mock lung tung trong page component

Ví dụ:

- `entities/product/model/mock-products.ts`
- `features/filter-products/model/filter-config.ts`

---

## Acceptance checklist bắt buộc

Trước khi kết thúc, Codex phải tự đối chiếu theo checklist này:

### Visual fidelity

- Layout tổng thể khớp với Figma
- Typography hierarchy gần đúng
- Màu sắc và contrast đúng
- Spacing và alignment nhất quán
- Border, radius, shadow đúng tinh thần thiết kế
- Card, filter, pagination, footer đúng grouping

### Architecture

- Folder placement đúng AD + FSD
- Không nhét quá nhiều logic vào page
- Shared / entity / feature / widget được phân vai rõ
- Không tạo component trùng trách nhiệm

### Code quality

- Component dễ đọc
- Props rõ ràng
- Không hardcode vô tổ chức
- Có thể mở rộng
- Reuse tốt

### Responsive

- Desktop hoạt động đúng
- Tablet/mobile có plan rõ hoặc đã triển khai
- Không vỡ layout ở các breakpoint chính

---

## Mẫu quyết định placement

Khi phân vân đặt component ở đâu, dùng bảng này:

| Trường hợp                                           | Đặt ở đâu             |
| ---------------------------------------------------- | --------------------- |
| Nút, input, icon, badge, text generic                | `shared/ui`           |
| UI gắn với product domain                            | `entities/product/ui` |
| Hành vi lọc, sắp xếp, thêm giỏ hàng                  | `features/...`        |
| Khối lớn ghép nhiều phần như sidebar, header, footer | `widgets/...`         |
| Entry page hoàn chỉnh                                | `pages/...`           |

---

## Prompt behavior rules cho Codex

Khi nhận task từ Figma, Codex phải tuân theo:

1. **Plan first, code second**
2. **Audit existing code before proposing new structure**
3. **Prefer existing tokens and components**
4. **Use AD for UI granularity, FSD for folder placement**
5. **State assumptions explicitly**
6. **Preserve visual hierarchy from Figma**
7. **Keep implementation maintainable**
8. **Do not introduce unrelated refactors**

---

## Mẫu trả lời tốt

Một câu trả lời tốt trước khi code phải có:

- Tóm tắt màn hình
- Breakdown UI
- Mapping vào `pages/widgets/features/entities/shared`
- Danh sách file cần tạo/sửa
- Token usage plan
- Responsive plan
- Risk/assumption
- Thứ tự triển khai

---

## Mẫu trả lời kém cần tránh

Không được trả lời kiểu:

- “Em sẽ tạo vài component rồi code dần”
- “Tôi sẽ convert Figma sang React”
- “Tạo tất cả trong pages cho nhanh”
- “Dùng hardcode trước rồi refactor sau”
- “Tạo folder common chứa mọi thứ”

---

## Ví dụ mapping cho màn Product Catalog

Ví dụ với màn Product Catalog:

- `pages/product-catalog`
    - page entry

- `widgets/header`
    - top nav

- `widgets/catalog-filters`
    - filter sidebar

- `widgets/catalog-toolbar`
    - title + result count + sort + view switch

- `widgets/product-grid`
    - grid section

- `widgets/pagination`
    - pagination area

- `widgets/footer`
    - footer area

- `entities/product/ui/product-card`
    - card sản phẩm

- `features/filter-products`
    - logic lọc
- `features/sort-products`
    - logic sắp xếp
- `features/add-to-cart`
    - thao tác thêm giỏ hàng
- `features/search-products`
    - ô tìm kiếm sản phẩm

- `shared/ui`
    - button, input, checkbox, select, badge, icon, container

---

## Lệnh mặc định cho Codex khi nhận task UI mới

Khi chưa chắc chắn, Codex phải bắt đầu bằng:

1. Tóm tắt screen
2. Liệt kê section
3. Audit codebase
4. Đề xuất placement theo AD + FSD
5. Lập plan file-by-file
6. Chỉ sau đó mới code

---

## Kỳ vọng cuối cùng

Đầu ra cuối cùng phải đạt:

- gần đúng Figma về mặt thị giác
- đúng kiến trúc repo
- rõ ràng về ownership
- dễ scale cho các màn tiếp theo
- không biến repo thành tập hợp component rời rạc thiếu tổ chức
