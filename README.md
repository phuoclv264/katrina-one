# Katrina One

**Ứng dụng quản lý nội bộ hệ thống Katrina Coffee**

Katrina One là ứng dụng web/mobile được xây dựng với Next.js và Capacitor, phục vụ cho việc quản lý ca làm việc, công việc, báo cáo, kho hàng và nhiều chức năng khác dành cho nhân viên và quản lý tại các cửa hàng Katrina Coffee.

![Next.js](https://img.shields.io/badge/Next.js-15.3.6-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Firebase](https://img.shields.io/badge/Firebase-11.9.1-orange?logo=firebase)
![Capacitor](https://img.shields.io/badge/Capacitor-7.4.4-blue?logo=capacitor)

## 📋 Tổng quan

**Katrina One** là ứng dụng quản lý toàn diện cho hệ thống cửa hàng cà phê, hỗ trợ 5 vai trò người dùng với các chức năng riêng biệt:

- 🍽️ **Phục vụ (Server)**: Quản lý checklist công việc theo ca, xem lịch làm việc
- ☕ **Pha chế (Bartender)**: Báo cáo vệ sinh, quản lý kho hàng
- 💰 **Thu ngân (Cashier)**: Báo cáo tài chính
- 👔 **Quản lý (Manager)**: Lập lịch làm việc, báo cáo tổng hợp, xem tất cả báo cáo
- 👑 **Chủ nhà hàng (Owner)**: Toàn quyền quản lý, tóm tắt AI, quản lý người dùng

### ✨ Tính năng chính

- ✅ **Quản lý công việc theo ca** (Sáng/Trưa/Tối)
- 📅 **Lập lịch làm việc tự động** với thuật toán thông minh
- 📊 **Báo cáo đa dạng**: Ca làm việc, vệ sinh, tài chính, tổng hợp
- 📦 **Quản lý kho hàng** với AI gợi ý đặt hàng
- 📸 **Upload và quản lý hình ảnh** với hỗ trợ offline
- 🤖 **Tích hợp AI** (Google Genkit) cho tóm tắt báo cáo và gợi ý
- 📱 **Hỗ trợ mobile** (iOS/Android) qua Capacitor
- 🔄 **Đồng bộ thời gian thực** với Firebase Firestore
- 💾 **Hoạt động offline** với IndexedDB cache
- 🔔 **Thông báo và nhắc nhở**

## 🏗️ Kiến trúc kỹ thuật

### Tech Stack

**Frontend:**
- **Framework**: Next.js 15.3.6 (App Router)
- **Language**: TypeScript 5
- **UI Framework**: Tailwind CSS + shadcn/ui (Radix UI primitives)
- **Mobile**: Capacitor 7.4.4

**Backend:**
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Storage**: Firebase Storage
- **AI**: Google Genkit AI

**State Management:**
- React Context API
- Real-time Firestore subscriptions
- IndexedDB (via idb) for offline storage

### 📁 Cấu trúc thư mục

```
katrina-one/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (app)/             # Protected routes
│   │   │   ├── admin/         # Admin dashboard
│   │   │   ├── attendance/    # Chấm công
│   │   │   ├── bartender/     # Pha chế features
│   │   │   ├── cashier/       # Thu ngân features
│   │   │   ├── checklist/     # Checklist công việc
│   │   │   ├── manager/       # Quản lý features
│   │   │   ├── reports/       # Xem báo cáo
│   │   │   ├── schedule/      # Lịch làm việc
│   │   │   ├── shift-scheduling/  # Lập lịch
│   │   │   ├── task-lists/    # Quản lý task lists
│   │   │   ├── users/         # Quản lý người dùng
│   │   │   └── violations/    # Vi phạm
│   │   └── api/               # API routes
│   ├── components/            # Shared React components
│   │   └── ui/               # shadcn/ui base components
│   ├── contexts/             # React Context providers
│   ├── hooks/                # Custom React hooks
│   ├── lib/                  # Core business logic
│   │   ├── data-store.ts     # Firestore operations
│   │   ├── schedule-store.ts # Scheduling logic
│   │   ├── cashier-store.ts  # Cashier operations
│   │   ├── reports-store.ts  # Report operations
│   │   ├── ai-service.ts     # AI integration
│   │   └── scheduler/        # Auto-scheduling
│   └── public/               # Static assets
├── android/                  # Android app (Capacitor)
├── ios/                      # iOS app (Capacitor)
├── docs/                     # Documentation
│   └── blueprint.md         # Design blueprint
├── firebase.json            # Firebase configuration
├── firestore.rules          # Firestore security rules
├── capacitor.config.ts      # Capacitor config
└── TESTING_PLAN.md          # Comprehensive testing plan
```

## 🚀 Bắt đầu

### Yêu cầu hệ thống

- **Node.js**: v20.x trở lên
- **npm**: v10.x trở lên
- **Firebase Project**: Cần có Firebase project với Firestore, Auth, và Storage
- **Git**: Để clone repository

### Cài đặt

1. **Clone repository:**
   ```bash
   git clone https://github.com/phuoclv264/katrina-one.git
   cd katrina-one
   ```

2. **Cài đặt dependencies:**
   ```bash
   npm install
   ```
   
   *Lưu ý: Việc cài đặt sẽ mất khoảng 30 giây và tạo thư mục `node_modules/` với hơn 1264 packages.*

3. **Cấu hình Firebase:**
   
   Firebase credentials đã được cấu hình sẵn trong `src/lib/firebase.ts`. Nếu cần thay đổi, chỉnh sửa file này.

4. **Build production:**
   ```bash
   npm run build
   ```
   
   *Build sẽ mất khoảng 30-60 giây. Expected warnings về IndexedDB có thể bỏ qua.*

5. **Chạy development server:**
   ```bash
   npm run dev
   ```
   
   Ứng dụng sẽ chạy tại: `http://localhost:9002`

### 📱 Build mobile app

**Android:**
```bash
npm run build
npx cap sync android
npx cap open android
```

**iOS:**
```bash
npm run build
npx cap sync ios
npx cap open ios
```

## 📜 Scripts có sẵn

| Script | Mô tả |
|--------|-------|
| `npm run dev` | Chạy development server với Turbopack trên port 9002 |
| `npm run build` | Build production (bỏ qua linting và type errors) |
| `npm start` | Chạy production server |
| `npm run typecheck` | Kiểm tra TypeScript types |
| `npm run lint` | Chạy ESLint (hiện tại có vấn đề config) |
| `npm run genkit:dev` | Khởi động Genkit dev server |
| `npm run genkit:watch` | Khởi động Genkit với watch mode |

## 🧪 Testing

Kế hoạch testing chi tiết được mô tả trong:
- `TESTING_PLAN.md` - Testing tổng quát cho tất cả chức năng
- `TESTING_PLAN_PASS_SHIFT.md` - Testing cho tính năng xin nghỉ ca

Hiện tại không có automated tests, testing được thực hiện thủ công theo các scenarios đã định nghĩa.

## 🔥 Firebase Collections

Ứng dụng sử dụng các Firestore collections chính:

- `users` - Thông tin người dùng và vai trò
- `reports` - Tất cả các loại báo cáo
- `schedules` - Lịch làm việc theo tuần
- `tasks` - Danh sách công việc cho Phục vụ
- `comprehensiveTasks` - Công việc cho Quản lý
- `bartenderTasks` - Công việc cho Pha chế
- `inventory` - Kho hàng và tồn kho
- `shiftPassRequests` - Yêu cầu nghỉ ca
- `attendanceRecords` - Chấm công
- `violations` - Vi phạm
- `appSettings` - Cài đặt ứng dụng

## 🎨 UI Components

Ứng dụng sử dụng **shadcn/ui** components được build trên:
- Radix UI primitives
- Tailwind CSS
- Lucide React icons

Configuration trong `components.json`:
- Style: default
- Base color: neutral
- CSS variables enabled
- RSC (React Server Components) enabled

## 🤖 AI Features

Tích hợp Google Genkit AI cho:
- ✍️ **Tóm tắt báo cáo** (Owner role)
- 📦 **Gợi ý đặt hàng** tự động dựa trên inventory (Bartender role)
- 📝 **Tạo và sắp xếp task lists** (Owner role)

AI service code trong `src/lib/ai-service.ts`

## ⚙️ Known Issues

### Build-time Warnings (Có thể bỏ qua)

1. **IndexedDB warnings**: "IndexedDB is not available or cleanup failed"
   - Xuất hiện khi build do SSR
   - Không ảnh hưởng functionality

2. **TypeScript errors** (2 errors):
   - Image component type mismatch
   - PopoverContent position prop issue
   - Build vẫn thành công do config `ignoreBuildErrors: true`

3. **ESLint circular dependency**:
   - `.eslintrc.json` có vấn đề cấu trúc
   - Build tự động skip linting

## 🔐 Role-Based Access Control

Ứng dụng implement RBAC nghiêm ngặt với 5 roles được định nghĩa trong `src/lib/types.ts`:

```typescript
type UserRole = "Phục vụ" | "Pha chế" | "Thu ngân" | "Quản lý" | "Chủ nhà hàng"
```

Mỗi route và component được guard bằng role checks. Xem chi tiết trong code để hiểu access patterns.

## 📖 Documentation

- `docs/blueprint.md` - Thiết kế ban đầu của ứng dụng
- `TESTING_PLAN.md` - Kế hoạch testing chi tiết
- `.github/copilot-instructions.md` - Hướng dẫn cho AI Copilot

## 🛠️ Development Workflow

1. **Luôn chạy `npm install` trước** khi bắt đầu
2. Make changes trong `src/`
3. **Validate bằng `npm run build`** - phải thành công
4. Test manually với `npm run dev`
5. Kiểm tra role-based access
6. Test offline functionality
7. Test real-time sync giữa các devices

## 🌐 Environment

**Không cần environment variables** để build. Tất cả Firebase config đã hardcoded trong `src/lib/firebase.ts` (intentional cho app này).

## 🤝 Contributing

Khi thêm features mới:
1. Đọc `TESTING_PLAN.md` để hiểu context
2. Hiểu rõ role-based access requirements
3. Check `src/lib/types.ts` cho data structures
4. Follow existing patterns và conventions
5. Test với tất cả các roles liên quan
6. Đảm bảo offline functionality hoạt động
7. Validate production build thành công

## 📝 Naming Conventions

- **Components**: PascalCase (e.g., `TaskList.tsx`)
- **Routes**: lowercase-with-hyphens (e.g., `shift-scheduling/`)
- **Utilities**: kebab-case (e.g., `data-store.ts`)
- **Imports**: Sử dụng path alias `@/` cho src imports

## 🌍 Ngôn ngữ

- **UI**: Tiếng Việt
- **Code**: English variable names với Vietnamese comments
- **Documentation**: Tiếng Việt

## 📄 License

Private project - All rights reserved.

## 📧 Contact

For internal use only within Katrina Coffee system.

---

**Made with ☕ for Katrina Coffee**