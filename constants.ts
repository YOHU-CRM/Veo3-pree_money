
import { SubscriptionPlan, UserProfile } from './types';

export const DEFAULT_PROFILE: UserProfile = {
  email: '379greenhome.co@gmail.com',
  accountType: 'Miễn phí 100%',
  expiryDate: 'Vĩnh viễn',
  usedCount: 687,
  limitText: 'Không giới hạn video',
  licenseInfo: 'Bản quyền: YOHU-PRO Studio. Hỗ trợ: 0973.480.488',
  machineId: 'YOHU-HW-7829-X'
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free_unlimited',
    name: 'Bản Miễn Phí 100%',
    price: '0 VNĐ',
    duration: 'Vĩnh viễn',
    concurrentLimit: 1,
    promptLimit: 999,
    subtitle: '≈ 0 VNĐ / video',
    stitchTime: '🎬Đạo diễn - Phân tích Link',
    videoLimitText: '♾️ TẠO VIDEO AI 1 PROMPT 1 LẦN'
  },
  {
    id: 'pro_1',
    name: 'Gói Chuyên Nghiệp 1',
    price: '479,000 VNĐ',
    duration: '30 ngày',
    concurrentLimit: 3,
    promptLimit: 199,
    subtitle: '≈ 1 VNĐ / video',
    stitchTime: '🔄 Nối video 30s đồng nhất cảnh',
    videoLimitText: '♾️ TẠO VIDEO AI KHÔNG GIỚI HẠN'
  },
  {
    id: 'pro_9',
    name: 'Gói Chuyên Nghiệp 9',
    price: '1,299,000 VNĐ',
    duration: '30 ngày',
    concurrentLimit: 5,
    promptLimit: 389,
    subtitle: '≈ 1 VNĐ / video',
    stitchTime: '🔄 Nối video 60s đồng nhất cảnh',
    videoLimitText: '♾️ TẠO VIDEO AI KHÔNG GIỚI HẠN'
  }
];

export const BANK_INFO = {
  name: 'PHẠM VĂN KHẢI',
  account: '0339606969',
  bank: 'MB Bank (Ngân hàng Quân Đội)'
};

export const HOLLYWOOD_FORMULA = `
CÔNG THỨC PROMPT TỐI ƯU (Optimal Studio Formula):
[Genre & Resolution], [Camera Angle & Lens], [Main character DNA...], [Supporting main character DNA...], [Action & emotional connection], [Environment & Lighting], [Physical texture], [Dialogue & Expression], [SFX], [Subtitle], [Guard Tags: Face Consistency, No nudity, Match cut, Centered...]
`;

export const DIRECTOR_MODE_INSTRUCTION = `
VAI TRÒ: Đạo diễn Hollywood v3.8 Siêu cấp.
NHIỆM VỤ: Phân tích CỐT TRUYỆN, THỂ LOẠI và DNA NHÂN VẬT để xuất ra DANH SÁCH CÂU LỆNH (PROMPTS).

YÊU CẦU QUAN TRỌNG:
1. DUY TRÌ DNA: Luôn nhắc lại DNA nhân vật trong mọi cảnh quay.
2. NGÔN NGỮ: TUYỆT ĐỐI tuân theo NGÔN NGỮ ĐẦU RA (Tiếng Anh hoặc Tiếng Việt) được yêu cầu.
3. ĐỊNH DẠNG: Xuất danh sách chỉ đánh số thứ tự (1. ..., 2. ...). Không tiêu đề, không giải thích.

CÔNG THỨC: ${HOLLYWOOD_FORMULA}
`;

export const LINK_ANALYSIS_INSTRUCTION = `
VAI TRÒ: Chuyên gia Phân tích Youtube & Biên kịch Hollywood Siêu cấp.
NHIỆM VỤ: Phân tích link Youtube và tạo kịch bản video gồm 70–90 CẢNH.

NGUYÊN TẮC PHÂN TÍCH (CỰC KỲ QUAN TRỌNG):
1. BÁM SÁT TIÊU ĐỀ YOUTUBE: Tiêu đề là chủ đề cốt lõi. Kịch bản phải xoay quanh và làm nổi bật tiêu đề này.
2. RÀ SOÁT CẢNH HOOK & GAY CẤN: Phải quét nội dung video để tìm các đoạn "Hook", cao trào, gay cấn nhất và ưu tiên đưa vào các câu lệnh prompt.
3. NGÔN NGỮ: TUYỆT ĐỐI tuân theo NGÔN NGỮ ĐẦU RA (Tiếng Anh hoặc Tiếng Việt) được yêu cầu.

YÊU CẦU ĐỊNH DẠNG (BẮT BUỘC):
- Xuất danh sách chỉ đánh số thứ tự mỗi câu lệnh (1. ..., 2. ...).
- Mỗi cảnh là một dòng đơn, không chia cột ngang, không chia ô.
- Cấu trúc: Scene [Số]. Visual: [Mô tả ảnh chi tiết] | VO: [Thuyết minh] | Tone: [Cảm xúc]
`;

export const SEAMLESS_FLOW_INSTRUCTION = `
VAI TRÒ: Chuyên gia Render Cinema Flow - Siêu render liền mạch v3.8.
NHIỆM VỤ: Tạo chuỗi kịch bản video sao cho cảnh sau kế thừa chính xác frame cuối của cảnh trước (Match Cut/Last Frame consistency).

NGUYÊN TẮC LIỀN MẠCH:
1. NỐI CẢNH (FRAME FLOW): Cảnh 1 bắt đầu. Từ Cảnh 2 trở đi, prompt phải chứa từ khóa "MATCH CUT FROM PREVIOUS SCENE", "CONTINUOUS ACTION", "INHERIT LAST FRAME" để đảm bảo tính nhất quán.
2. DUY TRÌ DNA & BỐI CẢNH: Giữ nguyên mô tả nhân vật và ánh sáng qua mọi cảnh quay.
3. ĐỊNH DẠNG: Xuất danh sách chỉ đánh số thứ tự (1. ..., 2. ...). Không chia cột, không giải thích.

CÔNG THỨC: ${HOLLYWOOD_FORMULA}
`;
