
import type { TimeSlot, TasksByShift, TaskSection, InventoryItem, ComprehensiveTaskSection, Suppliers, ViolationCategory } from './types';

export const staff: { pin: string, name: string }[] = [
  { pin: '0001', name: 'Phước' },
  { pin: '0002', name: 'Thảo' },
];

export const tasksByShift: TasksByShift = {
  sang: {
    name: 'Ca Sáng',
    sections: [
      {
        title: 'Đầu ca',
        tasks: [
          { id: 'sang-1', text: 'Đảm bảo trà nước của khách luôn đầy đủ', type: 'photo' },
          { id: 'sang-2', text: 'Đảm bảo trà nước tự phục vụ T2 luôn sẵn sàng', type: 'photo' },
          { id: 'sang-3', text: 'Đảm bảo các cửa kính đã được lau sạch sẽ', type: 'photo' },
        ],
      },
      {
        title: 'Trong ca',
        tasks: [
            { id: 'sang-4', text: 'Đảm bảo WC T1 sạch, thơm, bồn tiểu, bồn cầu sạch', type: 'photo' },
            { id: 'sang-5', text: 'Đảm bảo WC T2 sạch, thơm, bồn tiểu, bồn cầu sạch', type: 'photo' },
        ]
      },
      {
        title: 'Cuối ca',
        tasks: [
            { id: 'sang-6', text: 'Đảm bảo khu vực không có khách đã được dọn sạch sẽ, cả trên mặt bàn lẫn dưới đất, bàn ghế sắp xếp gọn gàng', type: 'photo' },
            { id: 'sang-7', text: 'Đảm bảo các bao rác đầy đều đã được thay', type: 'photo' },
        ]
      }
    ],
  },
  trua: {
    name: 'Ca Trưa',
    sections: [
        {
            title: 'Đầu ca',
            tasks: [
                { id: 'trua-1', text: 'Đảm bảo khu vực không có khách đã được dọn sạch sẽ, cả trên mặt bàn lẫn dưới đất, bàn ghế sắp xếp gọn gàng', type: 'photo' },
                { id: 'trua-2', text: 'Đảm bảo các ghế dù đều sạch, hoặc đều được rửa', type: 'photo' },
            ]
        },
        {
            title: 'Trong ca',
            tasks: [
                { id: 'trua-3', text: 'Đảm bảo thùng tách nước, thùng lau nhà đã được dọn sạch, các bao rác đã được kiểm tra, thay thế', type: 'photo' },
            ]
        },
        {
            title: 'Cuối ca',
            tasks: [
                { id: 'trua-4', text: 'Đảm bảo ly trà đã được rửa đầy đủ, xếp chồng kiểu tháp để nước trong ly chảy ra, chấm công ra', type: 'photo' },
                { id: 'trua-5', text: 'Đảm bảo đèn đã được bật đúng', type: 'photo' },
                { id: 'trua-6', text: 'Đảm bảo các chậu cây đã được tưới', type: 'photo' },
            ]
        }
    ],
  },
  toi: {
    name: 'Ca Tối',
    sections: [
        {
            title: 'Đầu ca',
            tasks: [
                { id: 'toi-1', text: 'Đảm bảo rèm che nắng cửa kính trong nhà đã được kéo lên (chỉ kéo khu vực không có khách)', type: 'photo' },
                { id: 'toi-2', text: 'Đảm bảo bạt đã kéo vào, tất cả dù đã được thu về', type: 'photo' },
                { id: 'toi-3', text: 'Đảm bảo các cửa kính đã được lau sạch sẽ', type: 'photo' },
            ]
        },
        {
            title: 'Trong ca',
            tasks: [
                { id: 'toi-4', text: 'Đảm bảo trà nước của khách luôn đầy đủ', type: 'photo' },
                { id: 'toi-5', text: 'Đảm bảo trà nước tự phục vụ T2 luôn sẵn sàng', type: 'photo' },
                { id: 'toi-6', text: 'Đảm bảo WC T1 sạch, thơm, bồn tiểu, bồn cầu sạch', type: 'photo' },
                { id: 'toi-7', text: 'Đảm bảo WC T2 sạch, thơm, bồn tiểu, bồn cầu sạch', type: 'photo' },
            ]
        },
        {
            title: 'Cuối ca',
            tasks: [
                { id: 'toi-8', text: 'Đảm bảo ly trà đã được rửa đầy đủ, xếp chồng kiểu tháp để nước trong ly chảy ra, chấm công ra', type: 'photo' },
                { id: 'toi-9', text: 'Đảm bảo đèn đã được bật đúng', type: 'photo' },
                { id: 'toi-10', text: 'Đảm bảo các chậu cây đã được tưới', type: 'photo' },
                { id: 'toi-11', text: 'Đảm bảo các bao rác đầy đều đã được thay', type: 'photo' }
            ]
        }
    ],
  },
};

export const bartenderTasks: TaskSection[] = [
    {
        title: 'Vệ sinh khu vực pha chế',
        tasks: [
            { id: 'bt-1', text: 'Lau dọn sạch sẽ bề mặt quầy bar', type: 'photo' },
            { id: 'bt-2', text: 'Sắp xếp gọn gàng các chai siro, nguyên liệu', type: 'photo' },
            { id: 'bt-3', text: 'Vệ sinh bồn rửa, đảm bảo không có rác tồn đọng', type: 'photo' },
        ]
    },
    {
        title: 'Vệ sinh dụng cụ',
        tasks: [
            { id: 'bt-4', text: 'Rửa sạch và lau khô các loại ly, cốc', type: 'photo' },
            { id: 'bt-5', text: 'Vệ sinh shaker, jigger và các dụng cụ pha chế khác', type: 'photo' },
            { id: 'bt-6', text: 'Tráng và úp ráo các ca đong, bình ủ trà', type: 'photo' },
        ]
    },
    {
        title: 'Vệ sinh thiết bị',
        tasks: [
            { id: 'bt-7', text: 'Vệ sinh máy pha cà phê: họng pha, tay cầm, vòi đánh sữa', type: 'photo' },
            { id: 'bt-8', text: 'Lau chùi bên ngoài tủ lạnh, tủ mát, tủ đông', type: 'photo' },
            { id: 'bt-9', text: 'Vệ sinh máy xay sinh tố, đảm bảo cối xay sạch sẽ', type: 'photo' },
        ]
    }
];

export const comprehensiveTasks: ComprehensiveTaskSection[] = [
  {
    title: "Tầng 1 - Trong nhà",
    tasks: [
      { "id": "comp-1-1-1", "text": "Không có mùi lạ", "type": "boolean" },
      { "id": "comp-1-1-2", "text": "Sàn nhà sạch sẽ", "type": "photo" },
    ]
  },
  {
    title: "Tầng 1 - WC Nam",
    tasks: [
      { "id": "comp-1-2-1", "text": "Không có mùi lạ", "type": "boolean" },
      { "id": "comp-1-2-2", "text": "Sàn nhà sạch sẽ", "type": "photo" },
    ]
  },
  {
    title: "Tầng 1 - WC Nữ",
    tasks: [
      { "id": "comp-1-3-1", "text": "Không có mùi lạ", "type": "boolean" },
      { "id": "comp-1-3-2", "text": "Sàn nhà sạch sẽ", "type": "photo" },
    ]
  },
  {
    title: "Tầng 1 - Ngoài sân",
    tasks: [
      { "id": "comp-1-4-1", "text": "Không có mùi lạ", "type": "boolean" },
      { "id": "comp-1-4-2", "text": "Sàn nhà sạch sẽ", "type": "photo" },
    ]
  },
  {
    title: "Tầng 1 - Vỉa hè và lòng đường",
    tasks: [
       { "id": "comp-1-5-1", "text": "Sạch sẽ, không có rác", "type": "photo" },
    ]
  },
  {
    title: "Tầng 2 - Trong nhà và Ngoài sân",
    tasks: [
       { "id": "comp-2-1-1", "text": "Không có mùi lạ", "type": "boolean" },
       { "id": "comp-2-1-2", "text": "Sàn nhà sạch sẽ", "type": "photo" },
    ]
  },
  {
    title: "Tầng 2 - WC",
    tasks: [
       { "id": "comp-2-2-1", "text": "Không có mùi lạ", "type": "boolean" },
       { "id": "comp-2-2-2", "text": "Sàn nhà sạch sẽ", "type": "photo" },
    ]
  },
  {
    title: "Các công việc khác",
    tasks: [
      { "id": "comp-8-1", "text": "Đánh giá thái độ làm việc nhân viên", "type": "opinion" },
      { "id": "comp-8-2", "text": "Trà nước đã được chuẩn bị sẵn sàng để phục vụ cho lượng khách đông (đặc biệt là ca sáng)", "type": "boolean" },
    ]
  }
];


export const inventoryList: InventoryItem[] = [
    { id: 'item-1', name: 'Đào Ngâm Thái Lan Dedu (12 hộp/thùng, 820gram/hộp)', category: 'TOPPING', supplier: 'Thiên Phước', unit: 'lon', minStock: 1, orderSuggestion: '4', requiresPhoto: true },
    { id: 'item-2', name: 'Hạt nổ củ năng Hồng dạng hũ', category: 'TOPPING', supplier: 'Thiên Phước', unit: 'hộp', minStock: 2, orderSuggestion: '5' },
    { id: 'item-3', name: 'Hạt Nổ Củ Năng Trắng Dedu (12 hộp/thùng, 900gram/hộp)', category: 'TOPPING', supplier: 'Thiên Phước', unit: 'hộp', minStock: 1, orderSuggestion: '2' },
    { id: 'item-4', name: 'Thạch Nha đam Trendy 1000GR', category: 'TOPPING', supplier: 'Thiên Phước', unit: 'gói', minStock: 1, orderSuggestion: '2' },
    { id: 'item-5', name: 'Trân châu đen Trendy 1000GR', category: 'TOPPING', supplier: 'Thiên Phước', unit: 'túi', minStock: 2, orderSuggestion: '2' },
    { id: 'item-6', name: 'Vải ngâm Fresko 565GR', category: 'TOPPING', supplier: 'Thiên Phước', unit: 'hộp', minStock: 2, orderSuggestion: '4' },
    { id: 'item-7', name: 'Vụn Dừa Nướng 1Kg - Coconut Jinnija', category: 'TOPPING', supplier: 'Thiên Phước', unit: 'gói', minStock: 1, orderSuggestion: '1' },
    { id: 'item-8', name: 'Xí muội', category: 'TOPPING', supplier: 'Chợ', unit: 'gói', minStock: 1, orderSuggestion: '1' },
    { id: 'item-9', name: 'Bơ cấp đông', category: 'TRÁI CÂY', supplier: 'Chợ', unit: 'gói', minStock: 10, orderSuggestion: '5kg' },
    { id: 'item-10', name: 'Cà rốt', category: 'TRÁI CÂY', supplier: 'Chợ', unit: 'trái', minStock: 5, orderSuggestion: '5kg' },
    { id: 'item-11', name: 'Cam décor', category: 'TRÁI CÂY', supplier: 'Chợ', unit: 'trái', minStock: 2, orderSuggestion: '2kg' },
    { id: 'item-12', name: 'Cam xanh', category: 'TRÁI CÂY', supplier: 'Chợ', unit: 'trái', minStock: 20, orderSuggestion: '10kg', requiresPhoto: true },
    { id: 'item-13', name: 'Chanh dây', category: 'TRÁI CÂY', supplier: 'Chợ', unit: 'trái', minStock: 10, orderSuggestion: '1-2kg' },
    { id: 'item-14', name: 'Chanh décor', category: 'TRÁI CÂY', supplier: 'Chợ', unit: 'trái', minStock: 4, orderSuggestion: '1kg' },
    { id: 'item-15', name: 'Cóc non', category: 'TRÁI CÂY', supplier: 'Chợ', unit: 'gr', minStock: 1, orderSuggestion: '3kg' },
    { id: 'item-16', name: 'Gừng', category: 'TRÁI CÂY', supplier: 'Chợ', unit: 'củ', minStock: 1, orderSuggestion: '2' },
    { id: 'item-17', name: 'Khổ qua', category: 'TRÁI CÂY', supplier: 'Chợ', unit: 'trái', minStock: 1, orderSuggestion: '1' },
    { id: 'item-18', name: 'Ổi trắng', category: 'TRÁI CÂY', supplier: 'Chợ', unit: 'trái', minStock: 10, orderSuggestion: '5kg' },
    { id: 'item-19', name: 'Sả', category: 'TRÁI CÂY', supplier: 'Chợ', unit: 'cây', minStock: 10, orderSuggestion: '1 bó' },
    { id: 'item-20', name: 'Thanh long đỏ', category: 'TRÁI CÂY', supplier: 'Chợ', unit: 'trái', minStock: 1, orderSuggestion: '1' },
    { id: 'item-21', name: 'Thơm', category: 'TRÁI CÂY', supplier: 'Chợ', unit: 'trái', minStock: 2, orderSuggestion: '5' },
    { id: 'item-22', name: 'Xoài cấp đông', category: 'TRÁI CÂY', supplier: 'Chợ', unit: 'gói', minStock: 10, orderSuggestion: '1-2kg' },
    { id: 'item-23', name: 'Lá dứa', category: 'DECOR', supplier: 'Chợ', unit: 'bó', minStock: 0.5, orderSuggestion: '1' },
    { id: 'item-24', name: 'Lá húng', category: 'DECOR', supplier: 'Chợ', unit: 'bó', minStock: 0.5, orderSuggestion: '1' },
    { id: 'item-25', name: 'Nụ hồng khô 50gram', category: 'DECOR', supplier: 'Thiên Phước', unit: 'gói', minStock: 0.2, orderSuggestion: '1' },
    { id: 'item-26', name: 'Đường ăn kiêng', category: 'GIA VỊ', supplier: 'Siêu thị', unit: 'hộp', minStock: 0.5, orderSuggestion: '1' },
    { id: 'item-27', name: 'Đường que Biên Hòa', category: 'GIA VỊ', supplier: 'Thiên Phước', unit: 'gói', minStock: 2, orderSuggestion: '5' },
    { id: 'item-28', name: 'Long nhãn khô', category: 'GIA VỊ', supplier: 'Chợ', unit: 'gr', minStock: 100, orderSuggestion: '100' },
    { id: 'item-29', name: 'Muối tinh', category: 'GIA VỊ', supplier: 'Siêu thị', unit: 'gói', minStock: 0.3, orderSuggestion: '1' },
    { id: 'item-30', name: 'Hạt dưa', category: 'THỨC ĂN', supplier: 'Chợ', unit: 'gói', minStock: 10, orderSuggestion: '40' },
    { id: 'item-31', name: 'Hạt hướng dương', category: 'THỨC ĂN', supplier: 'Chợ', unit: 'gói', minStock: 10, orderSuggestion: '40' },
    { id: 'item-32', name: 'Ly giấy 270ml (không được hết, chú ý kiểm tra thường xuyên)', category: 'LY', supplier: 'Ly Giấy Việt', unit: 'cây', minStock: 5, orderSuggestion: '5' },
    { id: 'item-33', name: 'Ly nhựa 350ml (không được hết, chú ý kiểm tra thường xuyên)', category: 'LY', supplier: 'Ly Giấy Việt', unit: 'cây', minStock: 10, orderSuggestion: '10' },
    { id: 'item-34', name: 'Ly nhựa 500ml (không được hết, chú ý kiểm tra thường xuyên)', category: 'LY', supplier: 'Ly Giấy Việt', unit: 'cây', minStock: 10, orderSuggestion: '10' },
    { id: 'item-35', name: 'Dĩa sứ lớn', category: 'CCDC', supplier: 'Gốm sứ Minh Long', unit: 'dĩa', minStock: 0, orderSuggestion: '0' },
    { id: 'item-36', name: 'Dĩa sứ nhỏ', category: 'CCDC', supplier: 'Gốm sứ Minh Long', unit: 'dĩa', minStock: 0, orderSuggestion: '0' },
    { id: 'item-37', name: 'Ly đựng sữa', category: 'CCDC', supplier: 'Gốm sứ Minh Long', unit: 'ly', minStock: 0, orderSuggestion: '0' },
    { id: 'item-38', name: 'Ly sứ 200ml', category: 'CCDC', supplier: 'Gốm sứ Minh Long', unit: 'ly', minStock: 0, orderSuggestion: '0' },
    { id: 'item-39', name: 'Ly sứ 90ml', category: 'CCDC', supplier: 'Gốm sứ Minh Long', unit: 'ly', minStock: 0, orderSuggestion: '0' },
    { id: 'item-40', name: 'Ly thuỷ tinh 90ml', category: 'CCDC', supplier: 'Ocean', unit: 'ly', minStock: 0, orderSuggestion: '0' },
    { id: 'item-41', name: 'Ly trà inox 1 lớp 350ml', category: 'CCDC', supplier: 'Inox Kim Hằng', unit: 'ly', minStock: 35, orderSuggestion: '35' },
    { id: 'item-42', name: 'Ly trà inox 2 lớp 170ml', category: 'CCDC', supplier: 'Inox Kim Hằng', unit: 'ly', minStock: 150, orderSuggestion: '150' },
    { id: 'item-43', name: 'Chổi quét sân', category: 'DCVS', supplier: 'Tạp hóa', unit: 'cây', minStock: 1, orderSuggestion: '1' },
    { id: 'item-44', name: 'Giấy ăn Gumi', category: 'DCVS', supplier: 'Tạp hóa', unit: 'gói', minStock: 20, orderSuggestion: '20' },
    { id: 'item-45', name: 'Giấy vệ sinh cuộn lớn', category: 'DCVS', supplier: 'Tạp hóa', unit: 'cuộn', minStock: 5, orderSuggestion: '5' },
];

export const suppliers: Suppliers = [
    "Thiên Phước",
    "Chợ",
    "Siêu thị",
    "Ly Giấy Việt",
    "Gốm sứ Minh Long",
    "Ocean",
    "Inox Kim Hằng",
    "Tạp hóa",
];

export const initialViolationCategories: ViolationCategory[] = [
    "Đi trễ",
    "Nói tục",
    "Đùa giỡn lớn tiếng",
    "Pha chế sai công thức",
    "Khác"
];

export const defaultTimeSlots: TimeSlot[] = [
    { start: '05:30', end: '12:00' },
    { start: '12:00', end: '17:00' },
    { start: '17:00', end: '23:00' },
    { start: '05:30', end: '23:00' },
];

    
