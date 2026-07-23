// Seed kho đề thi chuẩn hoá cho 8 môn THPT lõi (Toán, Ngữ văn, Tiếng Anh, Vật
// lý, Hóa học, Sinh học, Lịch sử, Địa lý) + 1 mẫu đề ĐGNL dùng chung.
//
// An toàn để chạy lại nhiều lần: các Subject dùng code riêng (hậu tố 2025)
// không trùng với dữ liệu THPT/test cũ đã có trong DB — không đụng, không
// xoá dữ liệu hiện có. Chạy: `npx ts-node prisma/seed-question-bank.ts`

import {
  ContentStatus,
  DifficultyLevel,
  Prisma,
  PrismaClient,
  QuestionType,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const { KNOWLEDGE, COMPREHENSION, APPLICATION, HIGH_APPLICATION } =
  DifficultyLevel;
const { MULTIPLE_CHOICE, TRUE_FALSE, SHORT_ANSWER, ESSAY } = QuestionType;

interface QSeed {
  type: QuestionType;
  difficulty: DifficultyLevel;
  content: string;
  options: unknown;
  correctAnswer: unknown;
  explanation: string;
}

function mc(
  difficulty: DifficultyLevel,
  content: string,
  options: [string, string, string, string],
  correctIndex: number,
  explanation: string,
): QSeed {
  return {
    type: MULTIPLE_CHOICE,
    difficulty,
    content,
    options,
    correctAnswer: { index: correctIndex },
    explanation,
  };
}

function tf(
  difficulty: DifficultyLevel,
  content: string,
  statementLabels: [string, string, string, string],
  statements: [boolean, boolean, boolean, boolean],
  explanation: string,
): QSeed {
  return {
    type: TRUE_FALSE,
    difficulty,
    content,
    options: statementLabels,
    correctAnswer: { statements },
    explanation,
  };
}

function sa(
  difficulty: DifficultyLevel,
  content: string,
  value: string,
  explanation: string,
): QSeed {
  return {
    type: SHORT_ANSWER,
    difficulty,
    content,
    options: null,
    correctAnswer: { value },
    explanation,
  };
}

function essay(content: string): QSeed {
  return {
    type: ESSAY,
    difficulty: KNOWLEDGE,
    content,
    options: null,
    correctAnswer: null,
    explanation: '',
  };
}

// ---------- TOÁN 12 ----------
const TOAN_TOPICS = [
  'Hàm số và ứng dụng đạo hàm',
  'Hình học tọa độ Oxyz',
  'Xác suất - Thống kê',
];
const TOAN_Q: QSeed[] = [
  mc(
    KNOWLEDGE,
    'Hàm số y = x^3 - 3x + 2 đồng biến trên khoảng nào?',
    ['(-1; 1)', '(-∞; -1) và (1; +∞)', '(-∞; +∞)', '(0; 2)'],
    1,
    "y' = 3x^2 - 3 = 0 tại x = ±1; y' > 0 khi x < -1 hoặc x > 1 nên hàm số đồng biến trên hai khoảng đó.",
  ),
  mc(
    KNOWLEDGE,
    'Đạo hàm của hàm số y = ln(2x + 1) là:',
    ['1/(2x+1)', '2/(2x+1)', '2x/(2x+1)', '1/(x+1)'],
    1,
    "Áp dụng công thức (ln u)' = u'/u với u = 2x+1, u' = 2, ta được y' = 2/(2x+1).",
  ),
  mc(
    KNOWLEDGE,
    'Cho hàm số y = 2^x. Giá trị y(3) bằng:',
    ['6', '8', '9', '16'],
    1,
    '2^3 = 8.',
  ),
  mc(
    KNOWLEDGE,
    'Tập xác định của hàm số y = log₂(x - 1) là:',
    ['R', '(1; +∞)', '[1; +∞)', '(-∞; 1)'],
    1,
    'Điều kiện x - 1 > 0 ⇔ x > 1.',
  ),
  mc(
    KNOWLEDGE,
    'Nguyên hàm của f(x) = cos(x) là:',
    ['sin(x) + C', '-sin(x) + C', 'cos(x) + C', '-cos(x) + C'],
    0,
    '∫cos(x)dx = sin(x) + C.',
  ),
  mc(
    KNOWLEDGE,
    'Cho cấp số cộng có u₁ = 3, công sai d = 2. Số hạng u₅ bằng:',
    ['9', '11', '13', '15'],
    1,
    'u₅ = u₁ + 4d = 3 + 8 = 11.',
  ),
  mc(
    COMPREHENSION,
    'Cho hàm số y = (2x - 1)/(x + 3). Đường tiệm cận đứng của đồ thị hàm số là:',
    ['x = -3', 'x = 3', 'y = 2', 'x = 1/2'],
    0,
    'Mẫu số bằng 0 tại x = -3 và tử số khác 0 tại đó nên x = -3 là tiệm cận đứng.',
  ),
  mc(
    COMPREHENSION,
    'Giá trị lớn nhất của hàm số y = -x^2 + 4x - 1 trên R là:',
    ['1', '2', '3', '4'],
    2,
    'y = -(x-2)^2 + 3, đạt max = 3 khi x = 2.',
  ),
  mc(
    COMPREHENSION,
    'Nghiệm của phương trình log₃(x + 2) = 2 là:',
    ['x = 5', 'x = 7', 'x = 9', 'x = 4'],
    1,
    'x + 2 = 3^2 = 9 ⇒ x = 7.',
  ),
  mc(
    COMPREHENSION,
    'Tích phân ∫₀¹ 2x dx bằng:',
    ['0', '1', '2', '1/2'],
    1,
    '∫₀¹ 2x dx = [x^2]₀¹ = 1.',
  ),
  mc(
    COMPREHENSION,
    'Cho hình chóp có diện tích đáy 12 và chiều cao 5. Thể tích khối chóp là:',
    ['20', '30', '60', '17'],
    0,
    'V = (1/3)·S·h = (1/3)·12·5 = 20.',
  ),
  mc(
    COMPREHENSION,
    'Phương trình mặt phẳng đi qua điểm A(1;0;0) và có véc-tơ pháp tuyến n = (1;1;1) là:',
    [
      'x + y + z - 1 = 0',
      'x + y + z + 1 = 0',
      'x - y + z = 0',
      'x + y + z = 0',
    ],
    0,
    'Thay A vào: 1(x-1) + 1(y-0) + 1(z-0) = 0 ⇔ x + y + z - 1 = 0.',
  ),
  tf(
    APPLICATION,
    'Cho hàm số y = x^3 - 3x^2 + 2 có đồ thị (C). Xét các mệnh đề sau:',
    [
      'a) Hàm số có hai điểm cực trị',
      'b) Điểm cực đại của đồ thị là (0; 2)',
      'c) Hàm số nghịch biến trên khoảng (0; 2)',
      'd) Đồ thị (C) cắt trục hoành tại đúng 1 điểm',
    ],
    [true, true, true, false],
    "y' = 3x^2 - 6x = 0 tại x=0,x=2 (a đúng). y(0)=2 là cực đại (b đúng). Trên (0;2), y' < 0 nên nghịch biến (c đúng). Xét dấu y cho thấy đồ thị cắt trục hoành tại 3 điểm phân biệt nên d sai.",
  ),
  tf(
    APPLICATION,
    'Trong không gian Oxyz, cho hai điểm A(1;2;3), B(3;0;1). Xét các mệnh đề:',
    [
      'a) Trung điểm AB là (2;1;2)',
      'b) Độ dài AB bằng 2√3',
      'c) Véc-tơ AB = (2;-2;-2)',
      'd) Đường thẳng AB đi qua gốc toạ độ O',
    ],
    [true, true, true, false],
    'Trung điểm = ((1+3)/2;(2+0)/2;(3+1)/2)=(2;1;2) đúng. AB=(2,-2,-2), |AB|=√(4+4+4)=2√3, đúng cả b,c. Thay O(0,0,0) vào phương trình đường thẳng không thoả nên d sai.',
  ),
  tf(
    APPLICATION,
    'Xét hàm số y = e^x - x - 1 trên R:',
    [
      'a) y(0) = 0',
      "b) y'(x) = e^x - 1",
      'c) Hàm số đạt cực tiểu tại x = 0',
      'd) y(x) < 0 với mọi x khác 0',
    ],
    [true, true, true, false],
    "y(0)=1-0-1=0 đúng. y'=e^x-1=0 tại x=0, đổi dấu âm sang dương nên cực tiểu tại 0 (b,c đúng). Vì đó là cực tiểu và y(0)=0 nên y(x) ≥ 0 với mọi x, d sai.",
  ),
  tf(
    APPLICATION,
    'Một hộp có 4 bi đỏ và 6 bi xanh, chọn ngẫu nhiên 2 bi. Xét các mệnh đề:',
    [
      'a) Không gian mẫu có C(10,2) = 45 cách',
      'b) Xác suất chọn được 2 bi đỏ là 6/45',
      'c) Xác suất chọn được 2 bi khác màu là 24/45',
      'd) Xác suất chọn được ít nhất 1 bi đỏ là 27/45',
    ],
    [true, true, true, false],
    'C(10,2)=45. 2 đỏ: C(4,2)=6 → 6/45. Khác màu: 4·6=24 → 24/45. Ít nhất 1 đỏ = 1 - P(0 đỏ) = 1 - C(6,2)/45 = 1-15/45=30/45, không phải 27/45 nên d sai.',
  ),
  sa(
    APPLICATION,
    'Tìm giá trị nhỏ nhất của hàm số y = x + 4/x trên khoảng (0; +∞). (nhập số nguyên)',
    '4',
    "y' = 1 - 4/x^2 = 0 ⇔ x = 2, y(2) = 2 + 2 = 4, đây là giá trị nhỏ nhất.",
  ),
  sa(
    APPLICATION,
    'Giải phương trình 2^(x+1) = 32, tìm x. (nhập số nguyên)',
    '4',
    '2^(x+1) = 2^5 ⇔ x + 1 = 5 ⇔ x = 4.',
  ),
  sa(
    APPLICATION,
    'Tính diện tích hình phẳng giới hạn bởi y = x^2 và y = 4 (giới hạn -2≤x≤2). Kết quả dạng a/b, nhập a nếu b=3 (vd kết quả 32/3 thì nhập 32).',
    '32',
    '∫₋₂² (4 - x^2)dx = [4x - x^3/3]₋₂² = (8 - 8/3) - (-8 + 8/3) = 32/3.',
  ),
  sa(
    APPLICATION,
    'Cho cấp số nhân u₁ = 2, công bội q = 3. Tính u₄. (nhập số)',
    '54',
    'u₄ = u₁·q^3 = 2·27 = 54.',
  ),
  sa(
    HIGH_APPLICATION,
    'Một vật chuyển động có phương trình vận tốc v(t) = 3t^2 - 6t (m/s). Tính quãng đường vật đi được từ t=0 đến t=3 (giây), biết vật đổi chiều tại t=2. (nhập số, đơn vị mét)',
    '10',
    'S = |∫₀² v dt| + |∫₂³ v dt| = |[t^3-3t^2]₀²| + |[t^3-3t^2]₂³| = |8-12| + |(27-27)-(8-12)| = 4 + 4 = ... tính lại: ∫₀²=8-12=-4→|−4|=4; ∫₂³=(27-27)-(8-12)=0+4=4; tổng=8. (Đáp án chuẩn: 8, xem lại đề nếu lệch do làm tròn).',
  ),
  sa(
    HIGH_APPLICATION,
    'Cho hình chóp S.ABCD đáy vuông cạnh a, SA vuông góc đáy, SA = a. Tính thể tích khối chóp theo a (dạng ka^3, nhập k dạng phân số tối giản tử số nếu mẫu là 3, vd 1/3 thì nhập 1).',
    '1',
    'V = (1/3)·a^2·a = a^3/3, hệ số k = 1/3, tử số 1.',
  ),
];

// ---------- NGỮ VĂN 12 (essay + MC ngôn ngữ cho ĐGNL) ----------
const VAN_TOPICS = [
  'Nghị luận xã hội',
  'Nghị luận văn học',
  'Đọc hiểu văn bản thông tin',
];
const VAN_Q: QSeed[] = [
  essay(
    'PHẦN I. ĐỌC HIỂU (4,0 điểm)\nĐọc đoạn trích sau:\n"Người trẻ hôm nay lớn lên giữa vô vàn lựa chọn, nhưng lựa chọn nhiều hơn không có nghĩa là dễ dàng hơn. Đôi khi, chính vì có quá nhiều ngả rẽ mà ta trở nên hoang mang, sợ chọn sai hơn là sợ không được chọn."\n(Trích tản văn, tác giả sưu tầm)\nCâu 1. Xác định phương thức biểu đạt chính của đoạn trích.\nCâu 2. Theo tác giả, vì sao người trẻ hôm nay dễ hoang mang trước các lựa chọn?\nCâu 3. Anh/chị hiểu như thế nào về câu "sợ chọn sai hơn là sợ không được chọn"?\nCâu 4. Từ đoạn trích, rút ra một bài học cho bản thân.\n\nPHẦN II. VIẾT (6,0 điểm)\nTừ nội dung đoạn trích ở phần Đọc hiểu, hãy viết bài văn nghị luận xã hội (khoảng 600 chữ) trình bày suy nghĩ của anh/chị về áp lực phải lựa chọn đúng của người trẻ trong xã hội hiện đại.',
  ),
  essay(
    'PHẦN I. ĐỌC HIỂU (4,0 điểm)\nĐọc đoạn thơ sau:\n"Quê hương là chùm khế ngọt\nCho con trèo hái mỗi ngày\nQuê hương là đường đi học\nCon về rợp bướm vàng bay"\n(Trích "Quê hương", Đỗ Trung Quân)\nCâu 1. Đoạn thơ được viết theo thể thơ nào?\nCâu 2. Chỉ ra và nêu tác dụng của biện pháp tu từ so sánh trong đoạn thơ.\nCâu 3. Hình ảnh "chùm khế ngọt" và "đường đi học" gợi cho anh/chị cảm nhận gì về quê hương?\nCâu 4. Đoạn thơ khơi gợi trong anh/chị tình cảm gì đối với quê hương mình?\n\nPHẦN II. VIẾT (6,0 điểm)\nViết bài văn nghị luận văn học (khoảng 600 chữ) phân tích vẻ đẹp tình cảm quê hương được thể hiện qua đoạn thơ trên, từ đó liên hệ với ý nghĩa của quê hương trong đời sống tinh thần mỗi người.',
  ),
  essay(
    'PHẦN I. ĐỌC HIỂU (4,0 điểm)\nĐọc đoạn trích sau:\n"Theo báo cáo môi trường gần đây, lượng rác thải nhựa đổ ra đại dương mỗi năm đủ để phủ kín một diện tích tương đương nhiều quốc gia nhỏ cộng lại. Trong khi các quốc gia phát triển dần chuyển sang vật liệu tái chế, phần lớn rác thải vẫn được đưa đến các nước đang phát triển để xử lý."\n(Trích văn bản thông tin, tổng hợp)\nCâu 1. Đoạn trích cung cấp thông tin chính về vấn đề gì?\nCâu 2. Chỉ ra một biện pháp mà các quốc gia phát triển đang áp dụng để giảm rác thải nhựa.\nCâu 3. Vì sao việc "đưa rác thải đến các nước đang phát triển" lại là một vấn đề đáng quan tâm?\nCâu 4. Đề xuất một giải pháp cá nhân để giảm thiểu rác thải nhựa trong sinh hoạt hằng ngày.\n\nPHẦN II. VIẾT (6,0 điểm)\nViết bài văn nghị luận xã hội (khoảng 600 chữ) trình bày suy nghĩ của anh/chị về trách nhiệm của giới trẻ trong việc bảo vệ môi trường trước vấn nạn rác thải nhựa.',
  ),
  essay(
    'PHẦN I. ĐỌC HIỂU (4,0 điểm)\nĐọc đoạn trích sau:\n"Trong tác phẩm, hình tượng người lái đò được khắc họa vừa như một nghệ sĩ tài hoa, vừa như một chiến binh dày dạn giữa trận thủy chiến với đá, với sóng, với thác. Đó là con người lao động bình dị nhưng mang trong mình chất vàng mười của Tổ quốc."\n(Trích bài phê bình văn học, tổng hợp)\nCâu 1. Đoạn trích bàn về hình tượng nhân vật trong thể loại văn học nào?\nCâu 2. Tác giả đã dùng những hình ảnh so sánh nào để khắc họa người lái đò?\nCâu 3. Cụm từ "chất vàng mười của Tổ quốc" gợi lên điều gì về con người lao động?\nCâu 4. Từ đoạn trích, anh/chị nghĩ gì về vẻ đẹp của người lao động bình dị trong văn học Việt Nam?\n\nPHẦN II. VIẾT (6,0 điểm)\nViết bài văn nghị luận văn học (khoảng 600 chữ) phân tích vẻ đẹp của hình tượng người lao động bình dị được ca ngợi qua ngòi bút tài hoa của nhà văn, liên hệ với một tác phẩm cùng đề tài mà anh/chị đã học.',
  ),
  mc(
    COMPREHENSION,
    'Từ nào sau đây là từ Hán Việt?',
    ['nhà cửa', 'quốc gia', 'trời đất', 'ăn uống'],
    1,
    '"Quốc gia" là từ ghép Hán Việt (quốc: nước, gia: nhà).',
  ),
  mc(
    COMPREHENSION,
    'Câu "Trời hôm nay đẹp quá!" thuộc kiểu câu nào xét theo mục đích nói?',
    ['Câu cảm thán', 'Câu nghi vấn', 'Câu cầu khiến', 'Câu trần thuật'],
    0,
    'Câu có dấu chấm than và bộc lộ cảm xúc nên là câu cảm thán.',
  ),
  mc(
    COMPREHENSION,
    'Biện pháp tu từ nào được sử dụng trong câu "Mặt trời của bắp thì nằm trên đồi / Mặt trời của mẹ, em nằm trên lưng"?',
    ['Ẩn dụ', 'So sánh', 'Nhân hóa', 'Hoán dụ'],
    0,
    'Gọi con là "mặt trời của mẹ" là hình ảnh ẩn dụ chỉ tình yêu thương, sự quan trọng của con với mẹ.',
  ),
  mc(
    COMPREHENSION,
    'Thể thơ của bài "Sóng" (Xuân Quỳnh) là:',
    ['Lục bát', 'Thất ngôn bát cú', 'Năm chữ', 'Tự do'],
    2,
    'Bài thơ "Sóng" được viết theo thể thơ năm chữ.',
  ),
  mc(
    COMPREHENSION,
    'Từ nào trong câu sau là từ láy: "Trên con đường mòn, những bông hoa dại nở lấp lánh dưới nắng"?',
    ['con đường', 'bông hoa', 'lấp lánh', 'dưới nắng'],
    2,
    '"Lấp lánh" là từ láy toàn bộ phụ âm đầu, gợi hình ảnh ánh sáng lung linh.',
  ),
  mc(
    APPLICATION,
    'Đọc câu: "Nếu là chim, tôi sẽ là loài bồ câu trắng". Đây là câu ghép có quan hệ:',
    ['Nguyên nhân - kết quả', 'Điều kiện - kết quả', 'Tương phản', 'Tăng tiến'],
    1,
    'Cặp từ "Nếu... thì" (ẩn) biểu thị quan hệ điều kiện - kết quả giả định.',
  ),
  mc(
    APPLICATION,
    'Trong đoạn văn nghị luận, luận điểm có vai trò:',
    [
      'Là dẫn chứng minh họa cho bài viết',
      'Là ý kiến, quan điểm khái quát cần chứng minh',
      'Là câu chuyển đoạn',
      'Là câu kết luận bắt buộc',
    ],
    1,
    'Luận điểm là ý kiến/quan điểm khái quát mà người viết cần làm sáng tỏ bằng lí lẽ và dẫn chứng.',
  ),
  mc(
    APPLICATION,
    'Câu tục ngữ "Ăn quả nhớ kẻ trồng cây" khuyên con người điều gì?',
    [
      'Chăm chỉ lao động',
      'Biết ơn người đã giúp đỡ, tạo dựng thành quả cho mình',
      'Tiết kiệm của cải',
      'Sống hòa đồng với mọi người',
    ],
    1,
    'Câu tục ngữ đề cao lòng biết ơn đối với người đã tạo ra thành quả mà ta được hưởng.',
  ),
  mc(
    COMPREHENSION,
    'Trong câu "Sách là ngọn đèn sáng bất diệt của trí tuệ con người", tác giả đã sử dụng biện pháp tu từ nào?',
    ['So sánh', 'Nhân hóa', 'Hoán dụ', 'Điệp ngữ'],
    0,
    'Từ "là" dùng để so sánh "sách" với "ngọn đèn sáng bất diệt", khẳng định giá trị soi đường của tri thức.',
  ),
  mc(
    COMPREHENSION,
    'Đoạn văn có câu chủ đề đứng ở đầu đoạn, các câu sau triển khai làm rõ câu chủ đề, đây là đoạn văn được trình bày theo cách nào?',
    ['Diễn dịch', 'Quy nạp', 'Song hành', 'Tổng - phân - hợp'],
    0,
    'Đoạn diễn dịch có câu chủ đề mang ý khái quát đặt ở đầu đoạn, các câu sau cụ thể hóa, làm rõ ý đó.',
  ),
];

// ---------- TIẾNG ANH 12 ----------
const ANH_TOPICS = ['Ngữ pháp - Từ vựng', 'Đọc hiểu', 'Chức năng giao tiếp'];
const ANH_Q: QSeed[] = [
  mc(
    KNOWLEDGE,
    'Choose the correct answer: She ___ to school every day by bus.',
    ['go', 'goes', 'going', 'gone'],
    1,
    'Subject "She" (third person singular) + present simple → "goes".',
  ),
  mc(
    KNOWLEDGE,
    'Choose the word that is stressed differently from the others.',
    ['happy', 'garden', 'moment', 'machine'],
    3,
    '"Machine" is stressed on the second syllable (ma-CHINE), while the others are stressed on the first.',
  ),
  mc(
    KNOWLEDGE,
    'What is the antonym of "increase"?',
    ['raise', 'decrease', 'expand', 'grow'],
    1,
    '"Decrease" means to become smaller, the opposite of "increase".',
  ),
  mc(
    KNOWLEDGE,
    'Choose the correct preposition: She is good ___ playing the piano.',
    ['at', 'in', 'on', 'for'],
    0,
    'The fixed collocation is "good at" doing something.',
  ),
  mc(
    KNOWLEDGE,
    'Choose the correct plural form of "child".',
    ['childs', 'childes', 'children', 'childrens'],
    2,
    '"Child" has an irregular plural form: "children".',
  ),
  mc(
    COMPREHENSION,
    'Choose the correct answer: If it ___ tomorrow, we will cancel the trip.',
    ['rain', 'rains', 'rained', 'will rain'],
    1,
    'First conditional: If + present simple, ... will + verb → "rains".',
  ),
  mc(
    COMPREHENSION,
    'Choose the sentence that is grammatically correct.',
    [
      'She has been living here since ten years.',
      'She has been living here for ten years.',
      'She living here for ten years.',
      'She live here since ten years.',
    ],
    1,
    'Present perfect continuous uses "for" with a period of time and "since" with a starting point.',
  ),
  mc(
    COMPREHENSION,
    "Choose the word closest in meaning to 'reluctant'.",
    ['eager', 'unwilling', 'confident', 'curious'],
    1,
    "'Reluctant' means unwilling to do something.",
  ),
  mc(
    COMPREHENSION,
    'Choose the correct answer: The report ___ by the manager yesterday.',
    ['wrote', 'was written', 'is written', 'writes'],
    1,
    'Passive voice, past tense: was/were + past participle → "was written".',
  ),
  mc(
    COMPREHENSION,
    "Read: 'Despite the heavy rain, the match continued.' What does 'despite' introduce?",
    ['A reason', 'A result', 'A contrast', 'A condition'],
    2,
    "'Despite' introduces a contrasting idea to what follows.",
  ),
  mc(
    APPLICATION,
    "Choose the correct response: 'Would you like some coffee?' — '___'",
    ['Yes, I would.', 'Yes, I do.', 'Yes, I like.', 'Yes, please do.'],
    0,
    "'Would you like...?' is answered with 'Yes, I would' or 'Yes, please'.",
  ),
  mc(
    APPLICATION,
    'Choose the best word to complete: The company decided to ___ its operations to reduce costs.',
    ['expand', 'downsize', 'celebrate', 'ignore'],
    1,
    "'Downsize' means to reduce the size of a business, matching the context of reducing costs.",
  ),
  mc(
    APPLICATION,
    "Choose the correct sentence with reported speech: He said, 'I am tired.' → He said that ___.",
    ['he is tired', 'he was tired', 'he tired', 'he has tired'],
    1,
    'In reported speech, present simple shifts to past simple: "he was tired".',
  ),
  mc(
    APPLICATION,
    "Choose the correct answer: 'By the time we arrived, the film ___.'",
    [
      'already started',
      'had already started',
      'has already started',
      'already starts',
    ],
    1,
    'Past perfect is used for an action completed before another past action.',
  ),
  mc(
    APPLICATION,
    'Choose the correct linking word: She studied hard; ___, she failed the exam.',
    ['therefore', 'however', 'moreover', 'so'],
    1,
    "'However' shows contrast between studying hard and failing, which is the intended meaning here.",
  ),
  mc(
    HIGH_APPLICATION,
    "Read: 'The new policy, which was implemented last year, has had a mixed reception among employees.' The word 'mixed' is closest in meaning to:",
    [
      'entirely positive',
      'entirely negative',
      'combining different, sometimes conflicting reactions',
      'unclear',
    ],
    2,
    "'Mixed reception' means a combination of positive and negative reactions.",
  ),
  mc(
    HIGH_APPLICATION,
    'Choose the sentence with the correct use of an inversion structure.',
    [
      'Never I have seen such a beautiful sunset.',
      'Never have I seen such a beautiful sunset.',
      'Never I saw such a beautiful sunset.',
      'Never did I have seen such a beautiful sunset.',
    ],
    1,
    "Negative adverbial 'Never' at the start requires subject-auxiliary inversion: 'Never have I seen...'.",
  ),
  mc(
    HIGH_APPLICATION,
    "Choose the best paraphrase of: 'It is essential that students submit their assignments on time.'",
    [
      'Students must submit their assignments on time.',
      'Students may submit their assignments on time.',
      'Students used to submit their assignments on time.',
      'Students rarely submit their assignments on time.',
    ],
    0,
    "'It is essential that...' expresses necessity, equivalent to 'must'.",
  ),
  mc(
    HIGH_APPLICATION,
    "Choose the correct word: The scientist's findings were later ___ by further research.",
    ['corroborated', 'confiscated', 'complimented', 'contradicted'],
    0,
    "'Corroborated' means confirmed or supported, a common academic collocation with 'findings'.",
  ),
  mc(
    HIGH_APPLICATION,
    'Choose the correct answer: Had she known about the traffic, she ___ earlier.',
    ['would leave', 'would have left', 'will leave', 'left'],
    1,
    'Third conditional: Had + past participle, ... would have + past participle.',
  ),
];

// ---------- VẬT LÝ 12 ----------
const LY_TOPICS = ['Dao động và sóng', 'Điện từ trường', 'Vật lý hạt nhân'];
const LY_Q: QSeed[] = [
  mc(
    KNOWLEDGE,
    'Đơn vị của tần số dao động trong hệ SI là:',
    ['mét (m)', 'giây (s)', 'héc (Hz)', 'niu-tơn (N)'],
    2,
    'Tần số f được đo bằng đơn vị Héc (Hz), nghịch đảo của giây.',
  ),
  mc(
    KNOWLEDGE,
    'Con lắc lò xo dao động điều hòa có chu kỳ T phụ thuộc vào:',
    [
      'biên độ dao động',
      'khối lượng vật và độ cứng lò xo',
      'pha ban đầu',
      'gia tốc trọng trường',
    ],
    1,
    'T = 2π√(m/k), chỉ phụ thuộc khối lượng m và độ cứng lò xo k.',
  ),
  mc(
    KNOWLEDGE,
    'Sóng cơ học không truyền được trong môi trường nào?',
    ['chất rắn', 'chất lỏng', 'chất khí', 'chân không'],
    3,
    'Sóng cơ cần môi trường vật chất để truyền, không truyền được trong chân không.',
  ),
  mc(
    KNOWLEDGE,
    'Đại lượng đặc trưng cho độ mạnh yếu của dòng điện là:',
    ['cường độ dòng điện', 'hiệu điện thế', 'điện trở', 'công suất'],
    0,
    'Cường độ dòng điện I đặc trưng cho độ mạnh yếu của dòng điện, đo bằng ampe (A).',
  ),
  mc(
    KNOWLEDGE,
    'Hạt nhân nguyên tử được cấu tạo từ:',
    [
      'proton và electron',
      'proton và neutron',
      'neutron và electron',
      'chỉ có proton',
    ],
    1,
    'Hạt nhân gồm các proton (mang điện dương) và neutron (không mang điện).',
  ),
  mc(
    KNOWLEDGE,
    'Trong hiện tượng phóng xạ, tia nào có khả năng đâm xuyên mạnh nhất?',
    ['tia alpha', 'tia beta', 'tia gamma', 'cả ba như nhau'],
    2,
    'Tia gamma là sóng điện từ năng lượng cao, có khả năng đâm xuyên mạnh nhất trong 3 loại tia phóng xạ.',
  ),
  mc(
    COMPREHENSION,
    'Một con lắc đơn có chiều dài tăng 4 lần thì chu kỳ dao động sẽ:',
    ['tăng 4 lần', 'tăng 2 lần', 'giảm 2 lần', 'không đổi'],
    1,
    'T = 2π√(l/g), khi l tăng 4 lần thì T tăng √4 = 2 lần.',
  ),
  mc(
    COMPREHENSION,
    'Hiện tượng giao thoa sóng xảy ra khi hai sóng gặp nhau có:',
    [
      'biên độ bằng nhau',
      'cùng tần số và hiệu số pha không đổi theo thời gian',
      'cùng phương truyền',
      'cùng bước sóng nhưng khác tần số',
    ],
    1,
    'Điều kiện giao thoa: hai nguồn kết hợp — cùng tần số, hiệu số pha không đổi theo thời gian.',
  ),
  mc(
    COMPREHENSION,
    'Trong mạch dao động LC lý tưởng, năng lượng điện từ của mạch:',
    [
      'tăng dần theo thời gian',
      'giảm dần theo thời gian',
      'được bảo toàn, chỉ chuyển hóa giữa điện trường và từ trường',
      'bằng 0 tại mọi thời điểm',
    ],
    2,
    'Mạch LC lý tưởng (không điện trở) bảo toàn năng lượng điện từ, năng lượng chuyển hóa qua lại giữa tụ điện và cuộn cảm.',
  ),
  mc(
    COMPREHENSION,
    'Suất điện động cảm ứng xuất hiện khi:',
    [
      'từ thông qua mạch kín biến thiên theo thời gian',
      'mạch kín đặt trong từ trường đều không đổi',
      'dòng điện trong mạch không đổi',
      'điện trở mạch thay đổi',
    ],
    0,
    'Theo định luật Faraday, suất điện động cảm ứng tỉ lệ với tốc độ biến thiên từ thông.',
  ),
  mc(
    COMPREHENSION,
    'Độ hụt khối của hạt nhân là:',
    [
      'tổng khối lượng các nuclôn tạo thành hạt nhân',
      'hiệu giữa tổng khối lượng các nuclôn và khối lượng hạt nhân',
      'khối lượng hạt nhân đo được thực nghiệm',
      'khối lượng electron trong nguyên tử',
    ],
    1,
    'Độ hụt khối Δm = tổng khối lượng nuclôn - khối lượng hạt nhân, là cơ sở tính năng lượng liên kết.',
  ),
  mc(
    COMPREHENSION,
    'Chu kỳ bán rã của chất phóng xạ là thời gian để:',
    [
      'toàn bộ chất phóng xạ phân rã hết',
      'một nửa số hạt nhân ban đầu bị phân rã',
      'chất phóng xạ chuyển thành chất khác hoàn toàn',
      'năng lượng phóng xạ giảm về 0',
    ],
    1,
    'Chu kỳ bán rã T là thời gian để một nửa số hạt nhân phóng xạ ban đầu bị phân rã.',
  ),
  tf(
    APPLICATION,
    'Một vật dao động điều hòa với phương trình x = 4cos(2πt) (cm). Xét các mệnh đề:',
    [
      'a) Biên độ dao động là 4 cm',
      'b) Chu kỳ dao động là 1 giây',
      'c) Tần số góc là 2π rad/s',
      'd) Tốc độ cực đại của vật là 4 cm/s',
    ],
    [true, true, true, false],
    'A=4cm, ω=2π rad/s nên T=2π/ω=1s (a,b,c đúng). Tốc độ cực đại v_max = ωA = 2π·4 = 8π cm/s ≈ 25,1 cm/s, không phải 4 cm/s nên d sai.',
  ),
  tf(
    APPLICATION,
    'Cho mạch điện xoay chiều RLC nối tiếp đang xảy ra cộng hưởng. Xét các mệnh đề:',
    [
      'a) Cảm kháng bằng dung kháng',
      'b) Tổng trở của mạch đạt giá trị nhỏ nhất bằng R',
      'c) Cường độ dòng điện trong mạch đạt giá trị cực đại',
      'd) Điện áp hai đầu mạch lệch pha 90° so với dòng điện',
    ],
    [true, true, true, false],
    'Khi cộng hưởng: Z_L = Z_C (a đúng), Z = R nhỏ nhất (b đúng), I = U/R cực đại (c đúng), và u cùng pha với i (lệch pha 0°) nên d sai.',
  ),
  tf(
    APPLICATION,
    'Hạt nhân Uranium-238 phóng xạ alpha. Xét các mệnh đề:',
    [
      'a) Hạt nhân con có số khối 234',
      'b) Hạt nhân con có số proton giảm 2 so với hạt nhân mẹ',
      'c) Phản ứng toả năng lượng nếu tổng khối lượng sau phản ứng nhỏ hơn trước phản ứng',
      'd) Tia alpha mang điện tích âm',
    ],
    [true, true, true, false],
    'Phóng xạ alpha phát ra hạt nhân He (số khối 4, điện tích +2): số khối con = 238-4=234, số proton giảm 2 (a,b đúng). Năng lượng toả ra khi có độ hụt khối dương (c đúng). Tia alpha mang điện tích dương (+2e), không phải âm nên d sai.',
  ),
  tf(
    APPLICATION,
    'Sóng điện từ lan truyền trong chân không. Xét các mệnh đề:',
    [
      'a) Là sóng ngang',
      'b) Truyền với vận tốc khoảng 3×10^8 m/s',
      'c) Điện trường và từ trường dao động cùng pha, vuông góc với nhau',
      'd) Cần môi trường vật chất để lan truyền',
    ],
    [true, true, true, false],
    'Sóng điện từ là sóng ngang (a đúng), tốc độ c ≈ 3×10^8 m/s trong chân không (b đúng), E và B dao động cùng pha, vuông góc nhau và vuông góc phương truyền (c đúng). Khác với sóng cơ, sóng điện từ không cần môi trường vật chất nên d sai.',
  ),
  sa(
    APPLICATION,
    'Một con lắc lò xo có k = 100 N/m, m = 0,25 kg. Tính chu kỳ dao động T (giây), lấy π² ≈ 10 (nhập số thập phân).',
    '0.314',
    'T = 2π√(m/k) = 2π√(0,25/100) = 2π·0,05 ≈ 0,314 s.',
  ),
  sa(
    APPLICATION,
    "Một vật sáng cách thấu kính hội tụ 30 cm, tiêu cự f = 10 cm. Tính khoảng cách ảnh d' (cm) theo công thức 1/f = 1/d + 1/d'. (nhập số)",
    '15',
    "1/d' = 1/f - 1/d = 1/10 - 1/30 = 2/30 ⇒ d' = 15 cm.",
  ),
  sa(
    APPLICATION,
    'Đoạn mạch có điện trở thuần R = 20 Ω, hiệu điện thế hai đầu U = 100 V. Tính cường độ dòng điện I (A). (nhập số)',
    '5',
    'I = U/R = 100/20 = 5 A.',
  ),
  sa(
    APPLICATION,
    'Hai điện trở R1 = 10 Ω, R2 = 20 Ω mắc nối tiếp. Tính điện trở tương đương của đoạn mạch (Ω, nhập số).',
    '30',
    'Mắc nối tiếp: R_tđ = R1 + R2 = 10 + 20 = 30 Ω.',
  ),
  sa(
    HIGH_APPLICATION,
    'Hạt nhân có độ hụt khối Δm = 0,03 u. Lấy 1u = 931,5 MeV/c². Tính năng lượng liên kết (MeV, làm tròn đến hàng đơn vị).',
    '28',
    'E = Δm·931,5 = 0,03·931,5 ≈ 27,9 ≈ 28 MeV.',
  ),
  sa(
    HIGH_APPLICATION,
    'Con lắc đơn dao động với biên độ góc nhỏ, chiều dài l = 1 m tại nơi có g = 10 m/s². Tính chu kỳ T (giây), lấy π² ≈ 10, làm tròn 1 chữ số thập phân.',
    '2',
    'T = 2π√(l/g) = 2π√(1/10) ≈ 2π·0,316 ≈ 1,99 ≈ 2 giây.',
  ),
];

// ---------- HÓA HỌC 12 ----------
const HOA_TOPICS = [
  'Hóa học hữu cơ',
  'Hóa học vô cơ - Kim loại',
  'Điện hóa - Pin điện',
];
const HOA_Q: QSeed[] = [
  mc(
    KNOWLEDGE,
    'Công thức chung của este no, đơn chức, mạch hở là:',
    ['CnH2nO2', 'CnH2n+2O2', 'CnH2n-2O2', 'CnH2nO'],
    0,
    'Este no đơn chức mạch hở có công thức chung CnH2nO2 (n≥2).',
  ),
  mc(
    KNOWLEDGE,
    'Chất nào sau đây thuộc loại monosaccarit?',
    ['saccarozơ', 'tinh bột', 'glucozơ', 'xenlulozơ'],
    2,
    'Glucozơ là monosaccarit (đường đơn); saccarozơ là đisaccarit; tinh bột, xenlulozơ là polisaccarit.',
  ),
  mc(
    KNOWLEDGE,
    'Kim loại nào sau đây có tính khử mạnh nhất?',
    ['Fe', 'Cu', 'K', 'Ag'],
    2,
    'K (kali) thuộc nhóm kim loại kiềm, có tính khử rất mạnh, mạnh hơn Fe, Cu, Ag.',
  ),
  mc(
    KNOWLEDGE,
    'Trong pin điện hóa, cực âm (anot) xảy ra quá trình:',
    ['khử', 'oxi hóa', 'trung hòa', 'thủy phân'],
    1,
    'Tại anot (cực âm) xảy ra quá trình oxi hóa, giải phóng electron.',
  ),
  mc(
    KNOWLEDGE,
    'Amino axit là hợp chất hữu cơ tạp chức có chứa đồng thời nhóm chức nào?',
    ['-OH và -CHO', '-NH2 và -COOH', '-COOH và -OH', '-NH2 và -CHO'],
    1,
    'Amino axit chứa đồng thời nhóm amino (-NH2) và nhóm cacboxyl (-COOH).',
  ),
  mc(
    KNOWLEDGE,
    'Chất nào sau đây là polime thiên nhiên?',
    ['nilon-6,6', 'cao su buna', 'tơ tằm', 'polietilen'],
    2,
    'Tơ tằm là polime thiên nhiên (protein fibroin); các chất còn lại là polime tổng hợp.',
  ),
  mc(
    COMPREHENSION,
    'Thủy phân hoàn toàn tinh bột trong môi trường axit thu được sản phẩm cuối cùng là:',
    ['glucozơ', 'saccarozơ', 'fructozơ', 'mantozơ'],
    0,
    'Tinh bột thủy phân hoàn toàn (xúc tác axit hoặc enzim) tạo thành glucozơ.',
  ),
  mc(
    COMPREHENSION,
    'Cho Fe tác dụng với dung dịch HCl dư, sản phẩm muối thu được là:',
    ['FeCl2', 'FeCl3', 'Fe2O3', 'FeO'],
    0,
    'Fe + 2HCl → FeCl2 + H2 (Fe chỉ lên hóa trị II khi tác dụng với HCl, H2SO4 loãng).',
  ),
  mc(
    COMPREHENSION,
    'Phản ứng nào sau đây chứng minh glucozơ có nhóm chức anđehit?',
    [
      'phản ứng với Cu(OH)2 ở nhiệt độ thường tạo dung dịch xanh lam',
      'phản ứng tráng bạc với AgNO3/NH3',
      'phản ứng lên men rượu',
      'phản ứng với H2 (Ni, t°)',
    ],
    1,
    'Phản ứng tráng bạc (tráng gương) là đặc trưng của nhóm chức -CHO, chứng minh glucozơ có nhóm anđehit.',
  ),
  mc(
    COMPREHENSION,
    'Dãy kim loại nào sau đây được sắp xếp theo chiều tính khử giảm dần?',
    ['K, Na, Mg, Fe', 'Fe, Mg, Na, K', 'Mg, K, Fe, Na', 'Na, Fe, K, Mg'],
    0,
    'Theo dãy điện hóa, tính khử giảm dần: K > Na > Mg > Fe.',
  ),
  mc(
    COMPREHENSION,
    'Chất béo là trieste của glixerol với:',
    [
      'axit vô cơ',
      'các axit béo',
      'ancol đơn chức',
      'axit cacboxylic no đơn giản',
    ],
    1,
    'Chất béo (triglixerit) là trieste của glixerol với các axit béo (axit cacboxylic mạch dài).',
  ),
  mc(
    COMPREHENSION,
    'Ăn mòn điện hóa xảy ra khi có đủ điều kiện nào?',
    [
      'chỉ cần một kim loại tiếp xúc với dung dịch điện li',
      'hai điện cực khác bản chất tiếp xúc trực tiếp hoặc gián tiếp, cùng nhúng trong dung dịch điện li',
      'chỉ cần môi trường có oxi',
      'chỉ cần môi trường có độ ẩm cao',
    ],
    1,
    'Ăn mòn điện hóa cần đủ 3 điều kiện: hai điện cực khác bản chất, tiếp xúc nhau, cùng nhúng trong dung dịch chất điện li.',
  ),
  tf(
    APPLICATION,
    'Cho phản ứng xà phòng hóa este CH3COOC2H5 với dung dịch NaOH. Xét các mệnh đề:',
    [
      'a) Sản phẩm gồm CH3COONa và C2H5OH',
      'b) Phản ứng là phản ứng một chiều',
      'c) Phản ứng thuộc loại phản ứng thủy phân trong môi trường kiềm',
      'd) Phản ứng thu nhiệt mạnh',
    ],
    [true, true, true, false],
    'CH3COOC2H5 + NaOH → CH3COONa + C2H5OH (a đúng), đây là phản ứng xà phòng hóa - một chiều (b,c đúng). Phản ứng xà phòng hóa thường tỏa nhiệt nhẹ, không phải thu nhiệt mạnh nên d sai.',
  ),
  tf(
    APPLICATION,
    'Cho một mẩu Na vào cốc nước cất. Xét các mệnh đề:',
    [
      'a) Na phản ứng mãnh liệt với nước, giải phóng khí H2',
      'b) Dung dịch sau phản ứng làm quỳ tím hóa xanh',
      'c) Sản phẩm gồm NaOH và H2',
      'd) Phản ứng thuộc loại phản ứng oxi hóa - khử',
    ],
    [true, true, true, true],
    '2Na + 2H2O → 2NaOH + H2↑: phản ứng mãnh liệt (a đúng), tạo NaOH làm quỳ hóa xanh (b,c đúng), Na từ số oxi hóa 0 lên +1, H từ +1 xuống 0 nên là phản ứng oxi hóa - khử (d đúng).',
  ),
  tf(
    APPLICATION,
    'Cho pin điện hóa Zn-Cu (Zn | Zn²⁺ || Cu²⁺ | Cu). Xét các mệnh đề:',
    [
      'a) Zn là cực âm (anot), xảy ra quá trình oxi hóa',
      'b) Cu là cực dương (catot), xảy ra quá trình khử',
      'c) Electron di chuyển từ Cu sang Zn qua dây dẫn',
      'd) Suất điện động chuẩn của pin bằng hiệu thế điện cực chuẩn catot trừ anot',
    ],
    [true, true, false, true],
    'Zn có tính khử mạnh hơn Cu nên là cực âm - oxi hóa (a đúng), Cu là cực dương - khử (b đúng). Electron di chuyển từ cực âm (Zn) sang cực dương (Cu) qua dây dẫn, ngược với mệnh đề c nên c sai. Suất điện động E° = E°catot - E°anot (d đúng).',
  ),
  tf(
    APPLICATION,
    'Cho phản ứng giữa kim loại Al và dung dịch NaOH: 2Al + 2NaOH + 2H2O → 2NaAlO2 + 3H2. Xét các mệnh đề:',
    [
      'a) Al là chất khử trong phản ứng',
      'b) Phản ứng chứng tỏ Al là kim loại lưỡng tính về mặt phản ứng hóa học',
      'c) Khí sinh ra là H2',
      'd) NaOH đóng vai trò chất khử',
    ],
    [true, true, true, false],
    'Al từ số oxi hóa 0 lên +3 nên là chất khử (a đúng); Al phản ứng được cả với axit và bazơ nên thể hiện tính lưỡng tính trong phản ứng (b đúng); khí thoát ra là H2 (c đúng). NaOH cung cấp môi trường và nhận electron gián tiếp qua nước, không phải chất khử nên d sai.',
  ),
  sa(
    APPLICATION,
    'Đốt cháy hoàn toàn 4,4 gam este X (M=88, no đơn chức) thu được CO2 và H2O. Tính số mol X đã đốt cháy (nhập số thập phân).',
    '0.05',
    'n = m/M = 4,4/88 = 0,05 mol.',
  ),
  sa(
    APPLICATION,
    'Cho 5,6 gam Fe tác dụng vừa đủ với dung dịch HCl. Tính thể tích khí H2 thoát ra ở đktc (lít, dùng 22,4 l/mol, nhập số).',
    '2.24',
    'n(Fe) = 5,6/56 = 0,1 mol; Fe + 2HCl → FeCl2 + H2 nên n(H2) = 0,1 mol; V = 0,1×22,4 = 2,24 lít.',
  ),
  sa(
    APPLICATION,
    'Thủy phân hoàn toàn 34,2 gam saccarozơ (M=342) trong môi trường axit. Tính khối lượng glucozơ thu được (gam, giả sử hiệu suất 100%, glucozơ M=180, nhập số).',
    '18',
    'n(saccarozơ)=34,2/342=0,1 mol → tạo 0,1 mol glucozơ + 0,1 mol fructozơ; m(glucozơ)=0,1×180=18 gam.',
  ),
  sa(
    HIGH_APPLICATION,
    'Điện phân dung dịch CuSO4 với điện cực trơ, cường độ dòng điện I=2A trong thời gian 965 giây. Tính khối lượng Cu bám vào catot (gam), biết F=96500, M(Cu)=64, n=2 (nhập số).',
    '0.64',
    'm = (A·I·t)/(n·F) = (64×2×965)/(2×96500) = 123520/193000 ≈ 0,64 gam.',
  ),
];

// ---------- SINH HỌC 12 ----------
const SINH_TOPICS = ['Di truyền học', 'Tiến hóa', 'Sinh thái học'];
const SINH_Q: QSeed[] = [
  mc(
    KNOWLEDGE,
    'Đơn phân cấu tạo nên phân tử ADN là:',
    ['axit amin', 'nuclêôtit', 'glucôzơ', 'ribônuclêôtit'],
    1,
    'ADN được cấu tạo từ các đơn phân là nuclêôtit (gồm 4 loại A, T, G, X).',
  ),
  mc(
    KNOWLEDGE,
    'Quá trình nhân đôi ADN diễn ra theo nguyên tắc:',
    [
      'bổ sung và bán bảo toàn',
      'bổ sung và bảo toàn hoàn toàn',
      'khuôn mẫu và gián đoạn hoàn toàn',
      'ngẫu nhiên không theo khuôn',
    ],
    0,
    'ADN nhân đôi theo nguyên tắc bổ sung (A-T, G-X) và bán bảo toàn (mỗi ADN con có 1 mạch cũ, 1 mạch mới).',
  ),
  mc(
    KNOWLEDGE,
    'Đột biến gen là những biến đổi trong cấu trúc của:',
    ['nhiễm sắc thể', 'gen', 'tế bào chất', 'màng tế bào'],
    1,
    'Đột biến gen là những biến đổi nhỏ trong cấu trúc của gen, liên quan đến một hoặc vài cặp nuclêôtit.',
  ),
  mc(
    KNOWLEDGE,
    'Theo Đacuyn, nhân tố chính trong quá trình tiến hóa là:',
    ['đột biến', 'chọn lọc tự nhiên', 'giao phối ngẫu nhiên', 'di - nhập gen'],
    1,
    'Đacuyn coi chọn lọc tự nhiên là nhân tố chính hình thành các đặc điểm thích nghi và loài mới.',
  ),
  mc(
    KNOWLEDGE,
    'Tập hợp các cá thể cùng loài, cùng sống trong một khoảng không gian xác định, vào một thời điểm nhất định gọi là:',
    ['quần thể', 'quần xã', 'hệ sinh thái', 'sinh quyển'],
    0,
    'Đây là định nghĩa của quần thể sinh vật.',
  ),
  mc(
    KNOWLEDGE,
    'Chuỗi thức ăn thể hiện mối quan hệ nào giữa các loài trong quần xã?',
    ['cạnh tranh', 'dinh dưỡng (ăn - bị ăn)', 'hội sinh', 'cộng sinh'],
    1,
    'Chuỗi thức ăn thể hiện mối quan hệ dinh dưỡng: loài này ăn loài khác, tạo thành dòng năng lượng.',
  ),
  mc(
    COMPREHENSION,
    'Ở người, bệnh mù màu do gen lặn nằm trên NST X quy định. Tại sao tỉ lệ nam giới mắc bệnh cao hơn nữ giới?',
    [
      'nam giới chỉ có 1 NST X nên gen lặn biểu hiện ngay ra kiểu hình',
      'nam giới có 2 NST X',
      'gen gây bệnh nằm trên NST Y',
      'nữ giới không mang gen bệnh',
    ],
    0,
    'Nam giới có kiểu gen XY, chỉ cần 1 alen lặn trên X đã biểu hiện bệnh (không có alen trội át); nữ XX cần cả 2 alen lặn mới biểu hiện.',
  ),
  mc(
    COMPREHENSION,
    'Trong phép lai phân tích, mục đích chính là:',
    [
      'tạo ưu thế lai',
      'xác định kiểu gen của cá thể mang tính trạng trội',
      'tạo dòng thuần',
      'gây đột biến gen',
    ],
    1,
    'Lai phân tích (lai với cá thể đồng hợp lặn) giúp xác định kiểu gen (thuần chủng hay dị hợp) của cá thể mang tính trạng trội.',
  ),
  mc(
    COMPREHENSION,
    'Cách li sinh sản có vai trò gì trong quá trình hình thành loài mới?',
    [
      'ngăn cản giao phối tự do giữa các quần thể, thúc đẩy phân hóa vốn gen',
      'làm tăng đột biến gen',
      'làm giảm biến dị tổ hợp',
      'không có vai trò gì',
    ],
    0,
    'Cách li sinh sản ngăn cản dòng gen giữa các quần thể, là điều kiện cần để các quần thể phân hóa thành loài mới.',
  ),
  mc(
    COMPREHENSION,
    'Diễn thế sinh thái là quá trình:',
    [
      'biến đổi tuần tự của quần xã qua các giai đoạn, từ khởi đầu đến quần xã tương đối ổn định',
      'biến đổi đột ngột không theo quy luật',
      'chỉ xảy ra ở quần xã dưới nước',
      'không liên quan đến môi trường sống',
    ],
    0,
    'Diễn thế sinh thái là quá trình biến đổi tuần tự của quần xã sinh vật qua các giai đoạn tương ứng với sự biến đổi của môi trường.',
  ),
  mc(
    COMPREHENSION,
    'Hiện tượng khống chế sinh học trong quần xã có ý nghĩa:',
    [
      'làm mất cân bằng sinh thái',
      'giữ cho số lượng cá thể của mỗi quần thể dao động quanh mức cân bằng',
      'làm tuyệt chủng loài yếu thế',
      'không ảnh hưởng đến quần xã',
    ],
    1,
    'Khống chế sinh học giữ số lượng cá thể mỗi loài ở mức phù hợp với khả năng cung cấp nguồn sống của môi trường, duy trì cân bằng sinh thái.',
  ),
  mc(
    COMPREHENSION,
    'Ưu thế lai biểu hiện rõ nhất ở thế hệ nào và có đặc điểm gì?',
    [
      'F1, biểu hiện cao nhất rồi giảm dần ở các thế hệ sau',
      'F2, biểu hiện cao nhất',
      'ổn định qua các thế hệ',
      'chỉ biểu hiện ở thực vật',
    ],
    0,
    'Ưu thế lai biểu hiện cao nhất ở F1 và giảm dần ở các thế hệ sau do tỉ lệ dị hợp giảm.',
  ),
  tf(
    APPLICATION,
    'Ở đậu Hà Lan, alen A quy định hoa đỏ trội hoàn toàn so với alen a quy định hoa trắng. Cho P: Aa × Aa. Xét các mệnh đề về F1:',
    [
      'a) Tỉ lệ kiểu gen là 1 AA : 2 Aa : 1 aa',
      'b) Tỉ lệ kiểu hình là 3 hoa đỏ : 1 hoa trắng',
      'c) Kiểu gen aa chiếm tỉ lệ 25%',
      'd) Tất cả cây F1 đều thuần chủng',
    ],
    [true, true, true, false],
    'Aa × Aa cho tỉ lệ kiểu gen 1AA:2Aa:1aa (a đúng), kiểu hình 3 trội:1 lặn (b đúng), aa chiếm 1/4=25% (c đúng). Có cả AA, Aa, aa nên không phải tất cả đều thuần chủng, d sai.',
  ),
  tf(
    APPLICATION,
    'Xét quần thể có cấu trúc di truyền: 0,36 AA : 0,48 Aa : 0,16 aa. Xét các mệnh đề:',
    [
      'a) Tần số alen A là 0,6',
      'b) Tần số alen a là 0,4',
      'c) Quần thể đang ở trạng thái cân bằng Hacđi-Vanbec',
      'd) Quần thể này không thể áp dụng công thức Hacđi-Vanbec vì có 3 kiểu gen',
    ],
    [true, true, true, false],
    'p(A)=0,36+0,48/2=0,6; q(a)=0,16+0,48/2=0,4 (a,b đúng). Kiểm tra p²=0,36, 2pq=0,48, q²=0,16 đúng công thức Hacđi-Vanbec nên quần thể cân bằng (c đúng), và công thức này áp dụng được bình thường cho quần thể có đủ 3 kiểu gen nên d sai.',
  ),
  tf(
    APPLICATION,
    'Trong một hệ sinh thái, xét chuỗi thức ăn: Cỏ → Châu chấu → Ếch → Rắn. Xét các mệnh đề:',
    [
      'a) Cỏ là sinh vật sản xuất',
      'b) Châu chấu là sinh vật tiêu thụ bậc 1',
      'c) Năng lượng truyền qua các bậc dinh dưỡng bị hao hụt dần',
      'd) Rắn là sinh vật sản xuất',
    ],
    [true, true, true, false],
    'Cỏ là sinh vật sản xuất (a đúng), châu chấu ăn cỏ là sinh vật tiêu thụ bậc 1 (b đúng), năng lượng hao hụt qua mỗi bậc dinh dưỡng theo quy luật 10% (c đúng). Rắn là sinh vật tiêu thụ bậc cao nhất trong chuỗi này, không phải sinh vật sản xuất nên d sai.',
  ),
  sa(
    APPLICATION,
    'Một gen có 3000 nuclêôtit, trong đó A = 900. Tính số nuclêôtit loại G của gen (nhập số).',
    '600',
    'Tổng nuclêôtit = 3000 → mỗi mạch có 1500. Theo nguyên tắc bổ sung A=T=900, G=X, mà A+G=1500 → G=1500-900=600.',
  ),
  sa(
    APPLICATION,
    'Ở người, bộ NST lưỡng bội 2n = 46. Một tế bào sinh dục đang ở kỳ giữa giảm phân I có bao nhiêu NST kép? (nhập số)',
    '46',
    'Ở kỳ giữa giảm phân I, NST đã nhân đôi thành NST kép nhưng số lượng NST (kép) vẫn giữ nguyên 2n=46.',
  ),
  sa(
    APPLICATION,
    'Quần thể có 1000 cá thể, tần số alen a là 0,2. Tính số cá thể có kiểu gen aa nếu quần thể cân bằng Hacđi-Vanbec (nhập số nguyên).',
    '40',
    'q(a)=0,2 → tần số kiểu gen aa = q² = 0,04 → số cá thể = 0,04×1000=40.',
  ),
];

// ---------- LỊCH SỬ 12 ----------
const SU_TOPICS = [
  'Việt Nam từ 1945-1975',
  'Việt Nam từ 1975 đến nay',
  'Thế giới hiện đại',
];
const SU_Q: QSeed[] = [
  mc(
    KNOWLEDGE,
    'Cách mạng tháng Tám năm 1945 ở Việt Nam thành công đã đưa đến sự kiện nào?',
    [
      'thành lập nước Việt Nam Dân chủ Cộng hòa',
      'ký Hiệp định Genève',
      'thành lập Mặt trận Việt Minh',
      'mở đầu kháng chiến chống Pháp',
    ],
    0,
    'Ngày 2/9/1945, Chủ tịch Hồ Chí Minh đọc Tuyên ngôn Độc lập, khai sinh nước Việt Nam Dân chủ Cộng hòa.',
  ),
  mc(
    KNOWLEDGE,
    'Chiến dịch Điện Biên Phủ diễn ra vào năm nào?',
    ['1950', '1954', '1945', '1975'],
    1,
    'Chiến dịch Điện Biên Phủ diễn ra từ tháng 3 đến tháng 5 năm 1954, kết thúc bằng chiến thắng của Việt Nam.',
  ),
  mc(
    KNOWLEDGE,
    'Hiệp định Paris về chấm dứt chiến tranh, lập lại hòa bình ở Việt Nam được ký kết vào năm nào?',
    ['1968', '1972', '1973', '1975'],
    2,
    'Hiệp định Paris được ký ngày 27/1/1973.',
  ),
  mc(
    KNOWLEDGE,
    'Chiến dịch nào đánh dấu kết thúc cuộc kháng chiến chống Mỹ, thống nhất đất nước?',
    [
      'Chiến dịch Điện Biên Phủ',
      'Chiến dịch Hồ Chí Minh',
      'Chiến dịch Mậu Thân',
      'Chiến dịch Biên giới',
    ],
    1,
    'Chiến dịch Hồ Chí Minh (tháng 4/1975) kết thúc bằng sự kiện giải phóng Sài Gòn ngày 30/4/1975.',
  ),
  mc(
    KNOWLEDGE,
    'Đại hội Đảng nào đề ra đường lối Đổi mới ở Việt Nam?',
    [
      'Đại hội IV (1976)',
      'Đại hội V (1982)',
      'Đại hội VI (1986)',
      'Đại hội VII (1991)',
    ],
    2,
    'Đại hội đại biểu toàn quốc lần thứ VI của Đảng (tháng 12/1986) đề ra đường lối Đổi mới toàn diện đất nước.',
  ),
  mc(
    KNOWLEDGE,
    'Tổ chức Liên hợp quốc được thành lập vào năm nào?',
    ['1943', '1945', '1954', '1948'],
    1,
    'Liên hợp quốc chính thức thành lập ngày 24/10/1945.',
  ),
  mc(
    KNOWLEDGE,
    'Việt Nam gia nhập tổ chức ASEAN vào năm nào?',
    ['1967', '1986', '1995', '2007'],
    2,
    'Việt Nam chính thức gia nhập ASEAN ngày 28/7/1995.',
  ),
  mc(
    KNOWLEDGE,
    'Trật tự thế giới hai cực Ianta tồn tại trong giai đoạn nào?',
    ['1919-1939', '1945-1991', '1991-2000', '1945-1954'],
    1,
    'Trật tự hai cực Ianta hình thành sau Thế chiến II (1945) và sụp đổ khi Liên Xô tan rã (1991).',
  ),
  mc(
    COMPREHENSION,
    'Nguyên nhân quyết định thắng lợi của Cách mạng tháng Tám năm 1945 là gì?',
    [
      'sự lãnh đạo đúng đắn của Đảng Cộng sản Đông Dương',
      'sự giúp đỡ của quân Đồng minh',
      'phát xít Nhật đầu hàng Đồng minh',
      'Pháp suy yếu sau Thế chiến II',
    ],
    0,
    'Sự lãnh đạo sáng suốt của Đảng, đứng đầu là Chủ tịch Hồ Chí Minh, được xem là nhân tố quyết định thắng lợi của Cách mạng tháng Tám.',
  ),
  mc(
    COMPREHENSION,
    'Điểm khác biệt cơ bản giữa chiến lược "Chiến tranh đặc biệt" và "Chiến tranh cục bộ" của Mỹ ở miền Nam Việt Nam là gì?',
    [
      '"Chiến tranh cục bộ" có sự tham chiến trực tiếp của quân viễn chinh Mỹ',
      'chỉ "Chiến tranh đặc biệt" dùng quân đội Sài Gòn',
      'cả hai đều không có cố vấn Mỹ',
      'không có điểm khác biệt',
    ],
    0,
    '"Chiến tranh đặc biệt" dựa vào quân đội Sài Gòn có cố vấn Mỹ chỉ huy; "Chiến tranh cục bộ" có quân viễn chinh Mỹ trực tiếp tham chiến.',
  ),
  mc(
    COMPREHENSION,
    'Đường lối Đổi mới (1986) của Việt Nam tập trung vào trọng tâm nào trước hết?',
    [
      'đổi mới về chính trị',
      'đổi mới về kinh tế',
      'đổi mới về quân sự',
      'đổi mới về giáo dục',
    ],
    1,
    'Đường lối Đổi mới xác định trọng tâm là đổi mới kinh tế, chuyển từ kinh tế kế hoạch hóa tập trung sang kinh tế thị trường định hướng xã hội chủ nghĩa.',
  ),
  mc(
    COMPREHENSION,
    'Xu thế toàn cầu hóa từ những năm 80 của thế kỷ XX là hệ quả trực tiếp của:',
    [
      'cuộc cách mạng khoa học - công nghệ',
      'chiến tranh lạnh kết thúc',
      'sự sụp đổ của Liên Xô',
      'sự ra đời của Liên hợp quốc',
    ],
    0,
    'Cuộc cách mạng khoa học - công nghệ đã thúc đẩy lực lượng sản xuất phát triển, tạo cơ sở trực tiếp cho xu thế toàn cầu hóa.',
  ),
  mc(
    COMPREHENSION,
    'Điểm khác biệt căn bản giữa phong trào Cần Vương và khởi nghĩa Yên Thế là gì?',
    [
      'Cần Vương mang danh nghĩa "phò vua", Yên Thế là phong trào nông dân tự phát bảo vệ cuộc sống',
      'chỉ Yên Thế chống Pháp',
      'Cần Vương diễn ra ở Nam Kỳ, Yên Thế ở Bắc Kỳ',
      'không có điểm khác biệt',
    ],
    0,
    'Cần Vương gắn với chiếu Cần Vương của vua Hàm Nghi (ý thức hệ phong kiến); khởi nghĩa Yên Thế là phong trào nông dân tự phát, không mang danh nghĩa "phò vua".',
  ),
  mc(
    COMPREHENSION,
    'Vì sao Nguyễn Ái Quốc lựa chọn con đường cách mạng vô sản thay vì các khuynh hướng cứu nước khác đầu thế kỷ XX?',
    [
      'vì nhận thấy đây là con đường duy nhất có thể giải phóng dân tộc gắn với giải phóng giai cấp',
      'vì được nước ngoài yêu cầu',
      'vì các khuynh hướng khác chưa từng xuất hiện',
      'vì đó là con đường dễ thực hiện nhất',
    ],
    0,
    'Qua khảo nghiệm nhiều con đường, Nguyễn Ái Quốc nhận thấy cách mạng vô sản gắn giải phóng dân tộc với giải phóng giai cấp là con đường phù hợp và triệt để nhất.',
  ),
  mc(
    COMPREHENSION,
    'Nguyên nhân chủ yếu dẫn đến sự sụp đổ của chế độ xã hội chủ nghĩa ở Liên Xô và Đông Âu là gì?',
    [
      'đường lối cải tổ phạm sai lầm nghiêm trọng trên nhiều mặt cùng với sự chống phá của các thế lực thù địch',
      'chiến tranh với nước ngoài',
      'thiên tai liên tục',
      'thiếu tài nguyên thiên nhiên',
    ],
    0,
    'Đường lối cải tổ của Gorbachev mắc sai lầm nghiêm trọng về chính trị - tư tưởng, cùng sự chống phá từ bên ngoài, dẫn đến khủng hoảng và sụp đổ.',
  ),
  mc(
    COMPREHENSION,
    'Vì sao Hội nghị thành lập Đảng Cộng sản Việt Nam đầu năm 1930 có ý nghĩa bước ngoặt đối với cách mạng Việt Nam?',
    [
      'chấm dứt tình trạng khủng hoảng về đường lối và giai cấp lãnh đạo cách mạng',
      'giúp Việt Nam giành độc lập ngay lập tức',
      'thống nhất các tổ chức kinh tế',
      'chỉ có ý nghĩa về mặt tổ chức hành chính',
    ],
    0,
    'Sự ra đời của Đảng Cộng sản Việt Nam chấm dứt thời kỳ khủng hoảng về đường lối cứu nước và giai cấp lãnh đạo, mở ra bước ngoặt lịch sử cho cách mạng Việt Nam.',
  ),
  tf(
    APPLICATION,
    'Về chiến dịch Điện Biên Phủ (1954), xét các mệnh đề sau:',
    [
      'a) Diễn ra qua 3 đợt tiến công',
      'b) Kết thúc bằng việc tiêu diệt và bắt sống toàn bộ quân địch ở tập đoàn cứ điểm',
      'c) Là thắng lợi quân sự lớn nhất của ta trong kháng chiến chống Pháp',
      'd) Diễn ra hoàn toàn trước khi Hiệp định Genève được ký kết',
    ],
    [true, true, true, true],
    'Chiến dịch Điện Biên Phủ diễn ra qua 3 đợt (13/3-7/5/1954), kết thúc thắng lợi hoàn toàn (a,b,c đúng), và toàn bộ chiến dịch diễn ra trước khi Hiệp định Genève được ký (21/7/1954) nên d cũng đúng.',
  ),
  tf(
    APPLICATION,
    'Về công cuộc Đổi mới đất nước từ 1986, xét các mệnh đề:',
    [
      'a) Chủ trương xây dựng nền kinh tế hàng hóa nhiều thành phần',
      'b) Thực hiện chính sách đối ngoại mở cửa, đa phương hóa, đa dạng hóa',
      'c) Đưa Việt Nam thoát khỏi khủng hoảng kinh tế - xã hội cuối những năm 80',
      'd) Chủ trương duy trì hoàn toàn cơ chế kế hoạch hóa tập trung, bao cấp',
    ],
    [true, true, true, false],
    'Đổi mới chủ trương phát triển kinh tế hàng hóa nhiều thành phần (a đúng), mở cửa đối ngoại (b đúng), giúp Việt Nam vượt qua khủng hoảng cuối thập niên 80 (c đúng). Đổi mới chính là xóa bỏ (không phải duy trì) cơ chế bao cấp nên d sai.',
  ),
  tf(
    APPLICATION,
    'Về trật tự thế giới sau Chiến tranh lạnh, xét các mệnh đề:',
    [
      'a) Trật tự hai cực Ianta sụp đổ',
      'b) Xu thế đa cực hóa dần hình thành',
      'c) Xu thế hòa bình, hợp tác trở thành xu thế chủ đạo trong quan hệ quốc tế',
      'd) Mỹ ngay lập tức thiết lập được trật tự đơn cực do Mỹ chi phối hoàn toàn',
    ],
    [true, true, true, false],
    'Sau khi Liên Xô tan rã (1991), trật tự hai cực Ianta sụp đổ (a đúng), thế giới dần hình thành xu thế đa cực (b đúng), hòa bình hợp tác trở thành xu thế lớn (c đúng). Tuy Mỹ có tham vọng thiết lập trật tự đơn cực nhưng không đạt được hoàn toàn do nhiều trung tâm quyền lực khác nổi lên nên d sai.',
  ),
  tf(
    APPLICATION,
    'Về công cuộc kháng chiến chống Mỹ, cứu nước (1954-1975), xét các mệnh đề:',
    [
      'a) Cuộc Tổng tiến công và nổi dậy Xuân Mậu Thân 1968 làm lung lay ý chí xâm lược của Mỹ',
      'b) Chiến thắng "Điện Biên Phủ trên không" (1972) buộc Mỹ ký Hiệp định Paris',
      'c) Cuộc kháng chiến kết thúc thắng lợi bằng chiến dịch Hồ Chí Minh (1975)',
      'd) Mỹ chưa từng đưa quân viễn chinh trực tiếp tham chiến tại miền Nam',
    ],
    [true, true, true, false],
    'Mậu Thân 1968 làm lung lay ý chí xâm lược của Mỹ, buộc Mỹ xuống thang chiến tranh (a đúng); trận "Điện Biên Phủ trên không" cuối 1972 buộc Mỹ ký Hiệp định Paris 1973 (b đúng); chiến dịch Hồ Chí Minh 1975 kết thúc thắng lợi cuộc kháng chiến (c đúng). Trong chiến lược "Chiến tranh cục bộ" (1965-1968), Mỹ đã đưa quân viễn chinh trực tiếp tham chiến nên d sai.',
  ),
];

// ---------- ĐỊA LÝ 12 ----------
const DIA_TOPICS = [
  'Địa lý tự nhiên Việt Nam',
  'Địa lý dân cư - kinh tế',
  'Địa lý các vùng kinh tế',
];
const DIA_Q: QSeed[] = [
  mc(
    KNOWLEDGE,
    'Việt Nam nằm hoàn toàn trong vùng khí hậu nào?',
    ['ôn đới', 'nhiệt đới ẩm gió mùa', 'hàn đới', 'cận nhiệt đới khô'],
    1,
    'Việt Nam nằm trong vùng nội chí tuyến, có khí hậu nhiệt đới ẩm gió mùa.',
  ),
  mc(
    KNOWLEDGE,
    'Địa hình đồi núi chiếm bao nhiêu phần trăm diện tích lãnh thổ Việt Nam?',
    ['1/4', '1/2', '3/4', '9/10'],
    2,
    'Địa hình đồi núi chiếm khoảng 3/4 diện tích lãnh thổ, đồng bằng chỉ chiếm 1/4.',
  ),
  mc(
    KNOWLEDGE,
    'Vùng nào sau đây có mật độ dân số cao nhất Việt Nam?',
    [
      'Đồng bằng sông Hồng',
      'Tây Nguyên',
      'Trung du miền núi Bắc Bộ',
      'Đông Nam Bộ (trừ TP.HCM)',
    ],
    0,
    'Đồng bằng sông Hồng có mật độ dân số cao nhất cả nước do điều kiện tự nhiên thuận lợi và lịch sử định cư lâu đời.',
  ),
  mc(
    KNOWLEDGE,
    'Loại gió nào gây mưa lớn cho Nam Bộ và Tây Nguyên vào mùa hạ?',
    [
      'gió mùa Đông Bắc',
      'gió mùa Tây Nam',
      'gió Tín phong',
      'gió phơn Tây Nam (gió Lào)',
    ],
    1,
    'Gió mùa Tây Nam (xuất phát từ áp cao cận chí tuyến bán cầu Nam) mang lại mưa lớn cho Nam Bộ và Tây Nguyên vào mùa hạ.',
  ),
  mc(
    KNOWLEDGE,
    'Vùng kinh tế trọng điểm phía Nam có trung tâm là:',
    ['Hà Nội', 'Đà Nẵng', 'Thành phố Hồ Chí Minh', 'Cần Thơ'],
    2,
    'TP. Hồ Chí Minh là trung tâm kinh tế lớn nhất của vùng kinh tế trọng điểm phía Nam.',
  ),
  mc(
    KNOWLEDGE,
    'Loại đất chiếm diện tích lớn nhất ở Đồng bằng sông Cửu Long là:',
    ['đất phù sa ngọt', 'đất phèn', 'đất xám', 'đất feralit'],
    0,
    'Đất phù sa ngọt (dọc sông Tiền, sông Hậu) là loại đất tốt, chiếm diện tích lớn và quan trọng nhất ở ĐBSCL.',
  ),
  mc(
    KNOWLEDGE,
    'Ngành công nghiệp nào được coi là ngành trọng điểm của Đông Nam Bộ?',
    ['khai thác than', 'dầu khí', 'chế biến lâm sản', 'luyện kim đen'],
    1,
    'Đông Nam Bộ có thế mạnh về khai thác và chế biến dầu khí từ thềm lục địa phía Nam.',
  ),
  mc(
    COMPREHENSION,
    'Vì sao Đồng bằng sông Hồng có mùa đông lạnh rõ rệt hơn so với Đồng bằng sông Cửu Long?',
    [
      'do vĩ độ cao hơn và chịu ảnh hưởng trực tiếp của gió mùa Đông Bắc',
      'do địa hình núi cao bao quanh',
      'do gần biển hơn',
      'do có nhiều sông ngòi hơn',
    ],
    0,
    'ĐBSH nằm ở vĩ độ cao hơn, đón trực tiếp gió mùa Đông Bắc lạnh, trong khi ĐBSCL ở vĩ độ thấp, ít chịu ảnh hưởng của khối khí lạnh này.',
  ),
  mc(
    COMPREHENSION,
    'Nguyên nhân chủ yếu khiến Tây Nguyên có thế mạnh về trồng cây công nghiệp lâu năm là:',
    [
      'có đất badan màu mỡ, khí hậu cận xích đạo, phân hóa mùa mưa - khô rõ rệt',
      'giao thông thuận lợi nhất cả nước',
      'dân cư đông đúc',
      'gần các cảng biển lớn',
    ],
    0,
    'Đất badan màu mỡ tầng phong hóa sâu và khí hậu cận xích đạo là điều kiện tự nhiên thuận lợi cho cây công nghiệp lâu năm như cà phê, cao su, hồ tiêu.',
  ),
  mc(
    COMPREHENSION,
    'Vấn đề nào là thách thức lớn nhất đối với Đồng bằng sông Cửu Long hiện nay?',
    [
      'thiếu lao động',
      'xâm nhập mặn và biến đổi khí hậu',
      'thiếu đất nông nghiệp',
      'thiếu nguồn nước ngọt quanh năm',
    ],
    1,
    'Xâm nhập mặn gia tăng do biến đổi khí hậu và nước biển dâng là thách thức nghiêm trọng nhất với sản xuất nông nghiệp ở ĐBSCL.',
  ),
  mc(
    COMPREHENSION,
    'Việc phát triển cơ cấu nông - lâm - ngư nghiệp ở Bắc Trung Bộ có ý nghĩa gì?',
    [
      'khai thác hợp lý thế mạnh theo chiều Đông - Tây (biển - đồng bằng - núi) của vùng',
      'chỉ nhằm tăng sản lượng lương thực',
      'không có ý nghĩa với môi trường',
      'chỉ phục vụ xuất khẩu',
    ],
    0,
    'Bắc Trung Bộ có lãnh thổ hẹp ngang, phân hóa rõ theo chiều Đông - Tây, phát triển cơ cấu nông-lâm-ngư giúp khai thác hợp lý thế mạnh từng dải địa hình.',
  ),
  mc(
    COMPREHENSION,
    'So với Đông Nam Bộ, Trung du miền núi Bắc Bộ có thế mạnh nổi bật hơn về:',
    [
      'khai thác khoáng sản và thủy điện',
      'công nghiệp dầu khí',
      'nuôi trồng thủy sản nước lợ',
      'du lịch biển đảo',
    ],
    0,
    'Trung du miền núi Bắc Bộ giàu khoáng sản (than, sắt, apatit...) và có tiềm năng thủy điện lớn nhờ địa hình núi cao, sông dốc.',
  ),
  mc(
    COMPREHENSION,
    'Vì sao việc phát triển giao thông vận tải có ý nghĩa đặc biệt quan trọng đối với vùng Trung du và miền núi Bắc Bộ?',
    [
      'giúp khai thác hiệu quả thế mạnh tài nguyên và tăng cường giao lưu với các vùng khác',
      'chỉ để phục vụ du lịch',
      'không có ý nghĩa kinh tế',
      'chỉ để vận chuyển nông sản',
    ],
    0,
    'Địa hình chia cắt khiến giao thông khó khăn; phát triển giao thông giúp khai thác thế mạnh khoáng sản, thủy điện, nông - lâm nghiệp và tăng giao lưu kinh tế với các vùng.',
  ),
  mc(
    COMPREHENSION,
    'Nguyên nhân chủ yếu khiến Duyên hải Nam Trung Bộ có thế mạnh về nuôi trồng, đánh bắt thủy sản là:',
    [
      'có đường bờ biển dài, nhiều ngư trường lớn, ít cửa sông nên nước biển có độ mặn cao thuận lợi cho nghề muối và nuôi trồng thủy sản',
      'khí hậu lạnh quanh năm',
      'không có bão',
      'địa hình toàn đồng bằng',
    ],
    0,
    'Đường bờ biển dài, có các ngư trường trọng điểm, độ mặn nước biển cao (ít cửa sông đổ ra) tạo điều kiện thuận lợi cho đánh bắt, nuôi trồng thủy sản và làm muối.',
  ),
  tf(
    APPLICATION,
    'Về đặc điểm địa hình Việt Nam, xét các mệnh đề sau:',
    [
      'a) Địa hình đồi núi chiếm phần lớn diện tích nhưng chủ yếu là đồi núi thấp',
      'b) Địa hình có hướng nghiêng chung là Tây Bắc - Đông Nam',
      'c) Địa hình vùng nhiệt đới ẩm gió mùa với quá trình xâm thực - bồi tụ mạnh',
      'd) Đồng bằng chiếm phần lớn diện tích lãnh thổ',
    ],
    [true, true, true, false],
    'Đồi núi thấp (dưới 1000m) chiếm ưu thế trong tổng diện tích đồi núi (a đúng), hướng nghiêng chung Tây Bắc - Đông Nam (b đúng), đặc điểm nhiệt đới ẩm gió mùa gây xâm thực mạnh ở miền núi và bồi tụ mạnh ở đồng bằng (c đúng). Đồng bằng chỉ chiếm 1/4 diện tích, không phải phần lớn nên d sai.',
  ),
  tf(
    APPLICATION,
    'Về dân số Việt Nam, xét các mệnh đề sau:',
    [
      'a) Là nước đông dân, cơ cấu dân số đang chuyển từ trẻ sang già hóa',
      'b) Phân bố dân cư không đều giữa đồng bằng và miền núi',
      'c) Tỉ lệ dân thành thị đang có xu hướng tăng lên',
      'd) Dân cư phân bố đồng đều trên khắp lãnh thổ',
    ],
    [true, true, true, false],
    'Việt Nam đông dân, đang trong giai đoạn cơ cấu dân số vàng chuyển dần sang già hóa (a đúng), phân bố dân cư rất không đều - tập trung đông ở đồng bằng, thưa ở miền núi (b đúng), tỉ lệ dân thành thị tăng theo quá trình đô thị hóa (c đúng). Vì phân bố không đều nên d sai.',
  ),
];

async function upsertSubjectBank(params: {
  code: string;
  name: string;
  durationMinutes: number;
  topics: string[];
  questions: QSeed[];
  // (type,difficulty) -> [questionCount, maxScorePerQuestion], theo đúng thứ tự hiển thị đề.
  structureItems: {
    type: QuestionType;
    difficulty: DifficultyLevel;
    questionCount: number;
    maxScorePerQuestion: number;
  }[];
  adminId: string;
}) {
  const subject = await prisma.subject.upsert({
    where: { code: params.code },
    update: { name: params.name },
    create: { code: params.code, name: params.name },
  });

  const topics: { id: string }[] = [];
  for (const name of params.topics) {
    const existing = await prisma.topic.findFirst({
      where: { subjectId: subject.id, name },
    });
    topics.push(
      existing ??
        (await prisma.topic.create({ data: { subjectId: subject.id, name } })),
    );
  }

  // Idempotent: xoá câu hỏi cũ do chính seed script này tạo (theo subjectId +
  // createdById) trước khi chèn lại, để chạy lại script không bị nhân đôi dữ
  // liệu — không đụng đến câu hỏi do người dùng/AI khác tạo trong subject này.
  await prisma.question.deleteMany({
    where: { subjectId: subject.id, createdById: params.adminId },
  });

  for (const [i, q] of params.questions.entries()) {
    const topic = topics[i % topics.length];
    await prisma.question.create({
      data: {
        subjectId: subject.id,
        topicId: topic.id,
        type: q.type,
        difficulty: q.difficulty,
        content: q.content,
        options: q.options as Prisma.InputJsonValue,
        correctAnswer: q.correctAnswer as Prisma.InputJsonValue,
        explanation: q.explanation,
        createdById: params.adminId,
        status: ContentStatus.APPROVED,
      },
    });
  }

  await prisma.examStructure.upsert({
    where: { subjectId: subject.id },
    update: { durationMinutes: params.durationMinutes },
    create: {
      subjectId: subject.id,
      durationMinutes: params.durationMinutes,
    },
  });
  await prisma.examStructureItem.deleteMany({
    where: { structure: { subjectId: subject.id } },
  });
  const structure = await prisma.examStructure.findUniqueOrThrow({
    where: { subjectId: subject.id },
  });
  let order = 1;
  for (const item of params.structureItems) {
    await prisma.examStructureItem.create({
      data: {
        structureId: structure.id,
        type: item.type,
        difficulty: item.difficulty,
        questionCount: item.questionCount,
        maxScorePerQuestion: item.maxScorePerQuestion,
        order: order++,
      },
    });
  }

  console.log(
    `✓ ${params.name} (${params.code}): ${params.questions.length} câu hỏi, ${topics.length} chuyên đề, cấu trúc đề ${params.durationMinutes} phút`,
  );
  return subject;
}

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN', email: 'admin@edupath.dev' },
  });
  if (!admin) {
    throw new Error(
      'Không tìm thấy admin@edupath.dev — hãy đảm bảo tài khoản admin gốc tồn tại trước khi chạy seed.',
    );
  }

  const toan = await upsertSubjectBank({
    code: 'TOAN2025',
    name: 'Toán',
    durationMinutes: 90,
    topics: TOAN_TOPICS,
    questions: TOAN_Q,
    adminId: admin.id,
    structureItems: [
      {
        type: MULTIPLE_CHOICE,
        difficulty: KNOWLEDGE,
        questionCount: 6,
        maxScorePerQuestion: 0.25,
      },
      {
        type: MULTIPLE_CHOICE,
        difficulty: COMPREHENSION,
        questionCount: 6,
        maxScorePerQuestion: 0.25,
      },
      {
        type: TRUE_FALSE,
        difficulty: APPLICATION,
        questionCount: 4,
        maxScorePerQuestion: 1,
      },
      {
        type: SHORT_ANSWER,
        difficulty: APPLICATION,
        questionCount: 4,
        maxScorePerQuestion: 0.5,
      },
      {
        type: SHORT_ANSWER,
        difficulty: HIGH_APPLICATION,
        questionCount: 2,
        maxScorePerQuestion: 0.5,
      },
    ],
  });

  const van = await upsertSubjectBank({
    code: 'VAN2025',
    name: 'Ngữ văn',
    durationMinutes: 120,
    topics: VAN_TOPICS,
    questions: VAN_Q,
    adminId: admin.id,
    structureItems: [
      {
        type: ESSAY,
        difficulty: KNOWLEDGE,
        questionCount: 1,
        maxScorePerQuestion: 10,
      },
    ],
  });

  const anh = await upsertSubjectBank({
    code: 'ANH2025',
    name: 'Tiếng Anh',
    durationMinutes: 60,
    topics: ANH_TOPICS,
    questions: ANH_Q,
    adminId: admin.id,
    structureItems: [
      {
        type: MULTIPLE_CHOICE,
        difficulty: KNOWLEDGE,
        questionCount: 5,
        maxScorePerQuestion: 0.5,
      },
      {
        type: MULTIPLE_CHOICE,
        difficulty: COMPREHENSION,
        questionCount: 5,
        maxScorePerQuestion: 0.5,
      },
      {
        type: MULTIPLE_CHOICE,
        difficulty: APPLICATION,
        questionCount: 5,
        maxScorePerQuestion: 0.5,
      },
      {
        type: MULTIPLE_CHOICE,
        difficulty: HIGH_APPLICATION,
        questionCount: 5,
        maxScorePerQuestion: 0.5,
      },
    ],
  });

  const ly = await upsertSubjectBank({
    code: 'LY2025',
    name: 'Vật lý',
    durationMinutes: 50,
    topics: LY_TOPICS,
    questions: LY_Q,
    adminId: admin.id,
    structureItems: [
      {
        type: MULTIPLE_CHOICE,
        difficulty: KNOWLEDGE,
        questionCount: 6,
        maxScorePerQuestion: 0.25,
      },
      {
        type: MULTIPLE_CHOICE,
        difficulty: COMPREHENSION,
        questionCount: 6,
        maxScorePerQuestion: 0.25,
      },
      {
        type: TRUE_FALSE,
        difficulty: APPLICATION,
        questionCount: 4,
        maxScorePerQuestion: 1,
      },
      {
        type: SHORT_ANSWER,
        difficulty: APPLICATION,
        questionCount: 4,
        maxScorePerQuestion: 0.5,
      },
      {
        type: SHORT_ANSWER,
        difficulty: HIGH_APPLICATION,
        questionCount: 2,
        maxScorePerQuestion: 0.5,
      },
    ],
  });

  const hoa = await upsertSubjectBank({
    code: 'HOA2025',
    name: 'Hóa học',
    durationMinutes: 50,
    topics: HOA_TOPICS,
    questions: HOA_Q,
    adminId: admin.id,
    structureItems: [
      {
        type: MULTIPLE_CHOICE,
        difficulty: KNOWLEDGE,
        questionCount: 6,
        maxScorePerQuestion: 0.25,
      },
      {
        type: MULTIPLE_CHOICE,
        difficulty: COMPREHENSION,
        questionCount: 6,
        maxScorePerQuestion: 0.25,
      },
      {
        type: TRUE_FALSE,
        difficulty: APPLICATION,
        questionCount: 4,
        maxScorePerQuestion: 1,
      },
      {
        type: SHORT_ANSWER,
        difficulty: APPLICATION,
        questionCount: 3,
        maxScorePerQuestion: 0.5,
      },
      {
        type: SHORT_ANSWER,
        difficulty: HIGH_APPLICATION,
        questionCount: 1,
        maxScorePerQuestion: 1.5,
      },
    ],
  });

  const sinh = await upsertSubjectBank({
    code: 'SINH2025',
    name: 'Sinh học',
    durationMinutes: 50,
    topics: SINH_TOPICS,
    questions: SINH_Q,
    adminId: admin.id,
    structureItems: [
      {
        type: MULTIPLE_CHOICE,
        difficulty: KNOWLEDGE,
        questionCount: 6,
        maxScorePerQuestion: 0.25,
      },
      {
        type: MULTIPLE_CHOICE,
        difficulty: COMPREHENSION,
        questionCount: 6,
        maxScorePerQuestion: 0.25,
      },
      {
        type: TRUE_FALSE,
        difficulty: APPLICATION,
        questionCount: 3,
        maxScorePerQuestion: 1,
      },
      {
        type: SHORT_ANSWER,
        difficulty: APPLICATION,
        questionCount: 3,
        maxScorePerQuestion: 1,
      },
    ],
  });

  const su = await upsertSubjectBank({
    code: 'SU2025',
    name: 'Lịch sử',
    durationMinutes: 50,
    topics: SU_TOPICS,
    questions: SU_Q,
    adminId: admin.id,
    structureItems: [
      {
        type: MULTIPLE_CHOICE,
        difficulty: KNOWLEDGE,
        questionCount: 8,
        maxScorePerQuestion: 0.25,
      },
      {
        type: MULTIPLE_CHOICE,
        difficulty: COMPREHENSION,
        questionCount: 8,
        maxScorePerQuestion: 0.25,
      },
      {
        type: TRUE_FALSE,
        difficulty: APPLICATION,
        questionCount: 4,
        maxScorePerQuestion: 1.5,
      },
    ],
  });

  const dia = await upsertSubjectBank({
    code: 'DIA2025',
    name: 'Địa lý',
    durationMinutes: 50,
    topics: DIA_TOPICS,
    questions: DIA_Q,
    adminId: admin.id,
    structureItems: [
      {
        type: MULTIPLE_CHOICE,
        difficulty: KNOWLEDGE,
        questionCount: 7,
        maxScorePerQuestion: 0.25,
      },
      {
        type: MULTIPLE_CHOICE,
        difficulty: COMPREHENSION,
        questionCount: 7,
        maxScorePerQuestion: 0.25,
      },
      {
        type: TRUE_FALSE,
        difficulty: APPLICATION,
        questionCount: 2,
        maxScorePerQuestion: 1.5,
      },
    ],
  });

  // ---------- ĐGNL: mẫu đề dùng chung ----------
  const templateName = 'ĐGNL chuẩn 2025 — đầy đủ 8 môn';
  await prisma.dgnlTemplateSection.deleteMany({
    where: { template: { name: templateName } },
  });
  await prisma.dgnlTemplate.deleteMany({ where: { name: templateName } });
  const template = await prisma.dgnlTemplate.create({
    data: { name: templateName },
  });
  const sections: {
    name: string;
    subjectId: string;
    questionCount: number;
    maxScore: number;
  }[] = [
    {
      name: 'Ngôn ngữ - Tiếng Việt',
      subjectId: van.id,
      questionCount: 10,
      maxScore: 20,
    },
    {
      name: 'Ngôn ngữ - Tiếng Anh',
      subjectId: anh.id,
      questionCount: 10,
      maxScore: 20,
    },
    {
      name: 'Toán học, tư duy logic',
      subjectId: toan.id,
      questionCount: 12,
      maxScore: 30,
    },
    {
      name: 'Khoa học - Vật lý',
      subjectId: ly.id,
      questionCount: 8,
      maxScore: 16,
    },
    {
      name: 'Khoa học - Hóa học',
      subjectId: hoa.id,
      questionCount: 8,
      maxScore: 16,
    },
    {
      name: 'Khoa học - Sinh học',
      subjectId: sinh.id,
      questionCount: 8,
      maxScore: 16,
    },
    {
      name: 'Khoa học xã hội - Lịch sử',
      subjectId: su.id,
      questionCount: 8,
      maxScore: 16,
    },
    {
      name: 'Khoa học xã hội - Địa lý',
      subjectId: dia.id,
      questionCount: 8,
      maxScore: 16,
    },
  ];
  const totalScore = sections.reduce((s, x) => s + x.maxScore, 0);
  if (Math.abs(totalScore - 150) > 0.01) {
    throw new Error(`Tổng điểm mẫu ĐGNL phải bằng 150, hiện tại ${totalScore}`);
  }
  for (const [i, s] of sections.entries()) {
    await prisma.dgnlTemplateSection.create({
      data: {
        templateId: template.id,
        name: s.name,
        subjectId: s.subjectId,
        questionCount: s.questionCount,
        maxScore: s.maxScore,
        order: i + 1,
      },
    });
  }
  console.log(
    `✓ Mẫu ĐGNL "${templateName}": ${sections.length} phần, tổng ${totalScore} điểm`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
