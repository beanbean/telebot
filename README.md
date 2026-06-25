# 🤖 Unified Telebot (Antigravity + Claude Code)

Đây là phiên bản bot Telegram tối thượng được merge từ `antigravity-telegram-suite` và `claude-telegram-bridge`. Bot đóng vai trò làm trung tâm điều khiển (Command Center) cho 2 AI Engine mạnh nhất hiện nay chạy song song trên cùng một máy chủ:

1. **Antigravity (CDP):** Điều khiển trình duyệt Chrome chạy Gemini Advanced qua giao thức Chrome DevTools Protocol.
2. **Claude Code (CLI):** Điều khiển trực tiếp tiến trình ngầm của thư viện dòng lệnh Anthropic.

---

## ✨ Tính năng cốt lõi

### 🔀 Dual Engine Switching (Chuyển đổi Engine linh hoạt)
*   **1 Bot, 2 Bộ não:** Gõ `/engine` hoặc nhấn nút **`🔀 Engine`** để chuyển đổi ngay lập tức luồng tin nhắn văn bản sang Antigravity hoặc Claude Code.
*   **Tính năng dùng chung:** Các nút lệnh hệ thống như `📸 Screen` (chụp màn hình IDE), `📦 Artifacts`, `🛠️ Skills`, `/status`, `/quota` luôn hoạt động ổn định bất kể đang ở Engine nào.

### 🧠 Tích hợp Claude Code (CLI)
*   **Tiết kiệm RAM tuyệt đối:** Chạy ngầm hoàn toàn bằng `spawn` NodeJS, tốn chỉ ~100-250MB RAM so với >1GB của trình duyệt Chrome.
*   **Báo cáo thời gian thực (Real-time Streaming):** Bắt sự kiện `--output-format stream-json`, hiển thị trực tiếp lên Telegram công cụ AI đang dùng (VD: `🛠 [1] Bash: npm run build` -> `🛠 [2] ViewFile: index.js`).
*   **Quản lý Session (`/session`):** Cho phép xem danh sách các phiên làm việc, khôi phục lại ngữ cảnh cũ, hoặc tạo mới (`🆕 New`) hoàn toàn.
*   **Hủy tức thì (`/stop`):** Bắn tín hiệu `SIGTERM` giết tiến trình ngay lập tức, giải phóng tài nguyên lập tức.

### 🌐 Tích hợp Antigravity (CDP)
*   **Cào dữ liệu bằng Session hiện tại:** Chạy trực tiếp trên trình duyệt nên giữ nguyên được Cookie, trạng thái đăng nhập. Cực kỳ đắc lực cho skill `/craw` để lấy dữ liệu từ các nhóm kín (Skool, khóa học).
*   **Tối ưu chi phí:** Không tốn phí API Token (chỉ tốn phí thuê bao Gemini Advanced hàng tháng). Thích hợp để đọc code base siêu lớn hoặc tác vụ lặp dài.
*   **Chế độ Turbo (`/turbo`):** Mở nhiều tab để chạy song song nhiều Agent, tạo hội đồng đánh giá chéo (Council Mode).

---

## 🚀 Hướng dẫn Cài đặt & Cấu hình

### Yêu cầu hệ thống
*   [Node.js](https://nodejs.org/) >= 18
*   Đã cài đặt [Claude Code CLI](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview) (`npm install -g @anthropic-ai/claude-code`)
*   Đã cài đặt Antigravity IDE (hoặc Standalone App).

### 1. Cấu hình biến môi trường (`.env`)
```env
# Telegram
BOT_TOKEN=your_telegram_bot_token
ALLOWED_CHAT_ID=your_chat_id

# Engine Mặc định (antigravity hoặc claude)
DEFAULT_ENGINE=claude

# Cấu hình Claude Code
CLAUDE_BIN=claude
CLAUDE_WORK_DIR=/Users/congdau/Projects
CLAUDE_SKIP_PERMS=true
CLAUDE_TIMEOUT=900000

# Cấu hình Antigravity CDP
AGENT_CDP_PORT=9333
IDE_CDP_PORT=9334
ANTIGRAVITY_PREFERRED_APP=ide
```

### 2. Khởi chạy hệ thống

**Bước 2.1: Bật tiến trình Antigravity (có mở cổng debug)**
```bash
# Trên macOS
open -a "Antigravity IDE" --args --remote-debugging-port=9334
```

**Bước 2.2: Bật Telebot qua PM2**
```bash
pm2 start src/index.js --name telebot
pm2 save
```

---

## 📱 Bảng lệnh (Command Reference)

### Quản lý Hệ thống & Engine
| Lệnh | Phím Bấm | Mô tả |
|---|---|---|
| *(nhập text)* | | Gửi tin nhắn trực tiếp tới Engine đang được chọn |
| `/engine` | `🔀 Engine` | Chuyển đổi qua lại giữa Antigravity và Claude Code |
| `/status` | | Xem trạng thái kết nối, Engine hiện tại, RAM/CPU và PID |
| `/stop` | | Hủy/kill tiến trình đang chạy (của cả CDP hoặc CLI) |
| `/screenshot` | `📸 Screen` | Chụp ảnh màn hình Antigravity IDE đang chạy |
| `/restart` | | Khởi động lại bot (chạy lệnh pm2 restart) |

### Tính năng riêng của Claude Code
| Lệnh | Phím Bấm | Mô tả |
|---|---|---|
| `/session` | `📋 Session` | Quản lý các phiên Claude Code (Resume hoặc tạo New) |
| `/model` | `🧠 Model` | Chọn model cho Claude CLI (Claude 3.5 Sonnet, v.v...) |

### Tính năng riêng của Antigravity (CDP)
| Lệnh | Phím Bấm | Mô tả |
|---|---|---|
| `/turbo` | `🚀 Turbo` | Bật chế độ đa luồng, hội ý nhiều Agent cùng lúc |
| `/goal` | | Giao phó toàn quyền cho Agent làm đến khi xong thì thôi |
| `/autoaccept` | | Tự động click các nút "Run", "Accept" xuất hiện trên UI |
| `/window` | | Đổi cửa sổ điều khiển khi mở nhiều IDE cùng lúc |

### Quản lý File & Artifacts
| Lệnh | Phím Bấm | Mô tả |
|---|---|---|
| `/artifacts` | `📦 Artifacts` | Hiển thị và tải xuống các file kết quả (Artifacts) |
| `/skills` | `🛠️ Skills` | Liệt kê toàn bộ kỹ năng có sẵn trong thư mục `_Skills/` |
| `/file` | | Duyệt thư mục dự án và tải file qua Telegram |

---

## 🏗️ Kiến trúc luồng tin nhắn (Message Router)

Khi người dùng gửi một đoạn Text:
1. Bot kiểm tra biến toàn cục `currentEngine`.
2. Nếu là `claude`:
   - Định tuyến vào `handleClaudeQuery(ctx, query)`.
   - `claude-controller.js` dùng hàm `spawn` gọi CLI.
   - Luồng sự kiện JSON được dịch ngược để nháy chữ "đang gõ..." và cập nhật trạng thái Tools sử dụng.
3. Nếu là `antigravity`:
   - Định tuyến vào `handleAgentQuery(ctx, query)`.
   - Gửi yêu cầu qua WebSocket tới cổng `9334` của Chrome.
   - Đọc liên tục (polling) cây DOM trình duyệt để bắt nội dung phản hồi.

---
<div align="center">
Tài liệu được cập nhật ngày: <b>2026-06-26</b> bởi <b>An (Antigravity)</b>.
Dành riêng cho hệ thống Brain2 của anh Công Đậu.
</div>
