"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractFinancialInfo = extractFinancialInfo;
const genai_1 = require("@google/genai");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
let apiKeys = [];
let currentKeyIndex = 0;
function getAI() {
    if (apiKeys.length === 0) {
        const keyStr = process.env.GEMINI_API_KEY || '';
        apiKeys = keyStr.split(',').map(k => k.trim()).filter(k => k.length > 0);
        if (apiKeys.length === 0)
            throw new Error('GEMINI_API_KEY is not set');
    }
    return new genai_1.GoogleGenAI({ apiKey: apiKeys[currentKeyIndex] });
}
function rotateKey() {
    currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
    console.log(`Rotated to Gemini API Key index ${currentKeyIndex}`);
}
/**
 * Trích xuất thông tin giao dịch hoặc sao kê từ hình ảnh
 * @param mimeType mime type của ảnh (vd: image/jpeg)
 * @param fileBuffer buffer của ảnh
 */
async function extractFinancialInfo(textContent = "", mimeType, base64Image, availableCards = []) {
    const cardsList = availableCards.length > 0 ? availableCards.join(', ') : 'Yến_BIDV, Công_Sacom...';
    const prompt = `
  Bạn là một chuyên gia tài chính AI. Hãy phân tích thông tin được cung cấp (có thể là hình ảnh sao kê, hoặc đoạn chat văn bản, hoặc cả hai).
  CỰC KỲ QUAN TRỌNG: Hãy dựa vào 4 số đuôi thẻ (nếu có) trên hóa đơn để nhận diện chính xác thẻ.
  Danh sách thẻ hợp lệ trong hệ thống: [${cardsList}]. Mọi kết quả trả về ở trường "card_name" BẮT BUỘC phải khớp chính xác 100% với một thẻ trong danh sách này.
  
  Hãy trích xuất các thông tin sau và trả về ĐÚNG ĐỊNH DẠNG JSON sau:
  
  Trường hợp 1: Nếu là thông báo sao kê (Statement):
  LƯU Ý CỰC KỲ QUAN TRỌNG VỀ DƯ NỢ SAO KÊ (total_debt):
  Trường "total_debt" phải là số tiền BẮT BUỘC PHẢI THANH TOÁN của kỳ này để không bị phạt lãi, CHỨ KHÔNG PHẢI là "Dư nợ" (tổng số tiền đang nợ). Cụ thể:
  - Với thẻ Sacombank: Lấy con số ở mục "Dư nợ TBGD còn lại".
  - Với thẻ BIDV: Lấy con số ở mục "Dư nợ kỳ sao kê".
  
  {
    "type": "STATEMENT",
    "card_name": "Tên thẻ khớp với danh sách hệ thống",
    "total_debt": 15000000,
    "minimum_payment": 500000,
    "due_date": "DD/MM/YYYY"
  }

  Trường hợp 2: Nếu là thông báo giao dịch / biến động số dư:
  {
    "type": "TRANSACTION",
    "card_name": "Tên thẻ khớp với danh sách hệ thống",
    "amount": 2000000,
    "description": "Thanh toán Herbalife",
    "transaction_date": "DD/MM/YYYY HH:mm",
    "is_online": true
  }
  *LƯU Ý MỤC is_online*: Hãy phân tích xem giao dịch này là thanh toán online hay quẹt thẻ vật lý (offline). (Ví dụ: quẹt tại trạm xăng, siêu thị, nhà hàng, cafe là offline -> false. Thanh toán qua mạng như Herbalife, Shopee, Tiki, Traveloka, thepdfguru, thanh toán hóa đơn điện/nước online là online -> true).

  Trường hợp 3: Nếu không phải 2 loại trên:
  {
    "type": "UNKNOWN",
    "message": "Không nhận diện được dữ liệu"
  }

  Văn bản người dùng cung cấp kèm theo: """${textContent}"""

  Chỉ trả về JSON, không kèm bất kỳ giải thích nào.
  `;
    try {
        const contents = [prompt];
        if (base64Image && mimeType) {
            contents.push({
                inlineData: {
                    data: base64Image,
                    mimeType: mimeType,
                },
            });
        }
        let retries = 0;
        while (retries < (apiKeys.length || 1)) {
            try {
                const response = await getAI().models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: contents,
                    config: {
                        responseMimeType: 'application/json',
                    }
                });
                const text = response.text || "{}";
                return JSON.parse(text);
            }
            catch (error) {
                if (error.status === 429 || (error.message && error.message.includes('429'))) {
                    console.log(`Quota exceeded for key index ${currentKeyIndex}, rotating...`);
                    rotateKey();
                    retries++;
                }
                else {
                    console.error("Lỗi AI OCR:", error);
                    return { type: "UNKNOWN", message: "Lỗi xử lý AI" };
                }
            }
        }
        return { type: "UNKNOWN", message: "Tất cả API Keys đều đã hết hạn mức (429)." };
    }
    catch (outerError) {
        console.error("Lỗi hệ thống:", outerError);
        return { type: "UNKNOWN", message: "Lỗi hệ thống OCR" };
    }
}
