
import type { TimeSlot, TasksByShift, TaskSection, InventoryItem, ComprehensiveTaskSection, Suppliers, ViolationCategory, OtherCostCategory, IncidentCategory, Product, GlobalUnit } from './types';
import { v4 as uuidv4 } from 'uuid';

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
    {
      "id": "item-1", "name": "Cà phê Robusta", "shortName": "CF Robusta", "category": "CÀ PHÊ", "supplier": "Thiên Phước",
      "baseUnit": "gram", "units": [{ "name": "gram", "isBaseUnit": true, "conversionRate": 1 }, { "name": "kg", "isBaseUnit": false, "conversionRate": 1000 }],
      "minStock": 500, "orderSuggestion": "2kg", "isImportant": true, "requiresPhoto": true, "dataType": 'number'
    },
    {
      "id": "item-2", "name": "Sữa đặc", "shortName": "Sữa đặc", "category": "SỮA", "supplier": "Siêu thị",
      "baseUnit": "hộp", "units": [{ "name": "hộp", "isBaseUnit": true, "conversionRate": 1 }, { "name": "thùng", "isBaseUnit": false, "conversionRate": 24 }],
      "minStock": 5, "orderSuggestion": "1 thùng", "isImportant": true, "requiresPhoto": false, "dataType": 'number'
    },
    {
      "id": "item-3", "name": "Sữa tươi không đường", "shortName": "Sữa tươi", "category": "SỮA", "supplier": "Siêu thị",
      "baseUnit": "hộp", "units": [{ "name": "hộp", "isBaseUnit": true, "conversionRate": 1 }, { "name": "thùng", "isBaseUnit": false, "conversionRate": 12 }],
      "minStock": 3, "orderSuggestion": "1 thùng", "isImportant": true, "requiresPhoto": false, "dataType": 'number'
    },
     {
      "id": "item-4", "name": "Chanh", "shortName": "Chanh", "category": "TRÁI CÂY", "supplier": "Chợ",
      "baseUnit": "kg", "units": [{ "name": "kg", "isBaseUnit": true, "conversionRate": 1 }],
      "minStock": 1, "orderSuggestion": "2kg", "isImportant": false, "requiresPhoto": true, "dataType": 'number'
    },
    {
      "id": "item-5", "name": "Ly nhựa", "shortName": "Ly nhựa", "category": "VẬT TƯ", "supplier": "Ly Giấy Việt",
      "baseUnit": "cái", "units": [{ "name": "cái", "isBaseUnit": true, "conversionRate": 1 }, { "name": "cây", "isBaseUnit": false, "conversionRate": 50 }],
      "minStock": 100, "orderSuggestion": "5 cây", "isImportant": false, "requiresPhoto": false, "dataType": 'number'
    },
    {
      "id": "item-6", "name": "Gas", "shortName": "Gas", "category": "VẬT TƯ", "supplier": "Tạp hóa",
      "baseUnit": "bình", "units": [{ "name": "bình", "isBaseUnit": true, "conversionRate": 1 }],
      "minStock": 1, "orderSuggestion": "1 bình", "isImportant": true, "requiresPhoto": false, "dataType": "list", "listOptions": ["hết", "còn"]
    }
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

export const initialOtherCostCategories: OtherCostCategory[] = [
    { id: uuidv4(), name: "Lương nhân viên" },
    { id: uuidv4(), name: "Tiền điện" },
    { id: uuidv4(), name: "Tiền nước" },
    { id: uuidv4(), name: "Tiền Internet" },
    { id: uuidv4(), name: "Phí giữ xe" },
    { id: uuidv4(), name: "Chi phí sửa chữa" },
    { id: uuidv4(), name: "Khác" },
];

export const initialIncidentCategories: IncidentCategory[] = [
    { id: uuidv4(), name: "Hư hỏng thiết bị" },
    { id: uuidv4(), name: "Vấn đề vệ sinh" },
    { id: uuidv4(), name: "Sự cố với khách hàng" },
    { id: uuidv4(), name: "Làm vỡ/hỏng tài sản" },
    { id: uuidv4(), name: "Khác" },
];


export const defaultTimeSlots: TimeSlot[] = [
    { start: '05:30', end: '12:00' },
    { start: '12:00', end: '17:00' },
    { start: '17:00', end: '23:00' },
];

export const initialProducts: Product[] = [
  { "id": "prod_1", "name": "ESPRESSO (CÀ PHÊ ĐEN PHA MÁY)", "category": "ESPRESSO", "note": "", "ingredients": [ { "inventoryItemId": "item-1", "name": "rúp đơn", "quantity": 1, "unit": "cái", "isMatched": true }, { "inventoryItemId": "đường-thẻ", "name": "Gói", "quantity": 1, "unit": "gói", "isMatched": false } ] },
  { "id": "prod_2", "name": "ESPRESSO SỮA (CÀ PHÊ SỮA PHA MÁY)", "category": "ESPRESSO", "note": "", "ingredients": [ { "inventoryItemId": "item-1", "name": "rúp đơn", "quantity": 1, "unit": "cái", "isMatched": true }, { "inventoryItemId": "item-2", "name": "ml", "quantity": 15, "unit": "ml", "isMatched": true } ] },
  { "id": "prod_3", "name": "ESPRESSO SÀI GÒN", "category": "ESPRESSO", "note": "", "ingredients": [ { "inventoryItemId": "item-1", "name": "rúp đôi", "quantity": 1, "unit": "cái", "isMatched": true }, { "inventoryItemId": "đường-ngô", "name": "ml", "quantity": 10, "unit": "ml", "isMatched": false } ] },
  { "id": "prod_4", "name": "ESPRESSO SỮA SÀI GÒN", "category": "ESPRESSO", "note": "", "ingredients": [ { "inventoryItemId": "item-1", "name": "rúp đôi", "quantity": 1, "unit": "cái", "isMatched": true }, { "inventoryItemId": "item-2", "name": "ml", "quantity": 20, "unit": "ml", "isMatched": true } ] },
  { "id": "prod_5", "name": "AMERICANO", "category": "ESPRESSO", "note": "", "ingredients": [ { "inventoryItemId": "item-1", "name": "rúp đơn", "quantity": 1, "unit": "cái", "isMatched": true }, { "inventoryItemId": "nước-lọc", "name": "ml", "quantity": 120, "unit": "ml", "isMatched": false } ] },
  { "id": "prod_6", "name": "CAPUCHINO", "category": "ESPRESSO", "note": "", "ingredients": [ { "inventoryItemId": "item-1", "name": "rúp đơn", "quantity": 1, "unit": "cái", "isMatched": true }, { "inventoryItemId": "item-3", "name": "ml", "quantity": 220, "unit": "ml", "isMatched": true }, { "inventoryItemId": "đường-thẻ", "name": "que", "quantity": 1, "unit": "que", "isMatched": false } ] },
  { "id": "prod_7", "name": "CÀ PHÊ PHIN ĐEN", "category": "CÀ PHÊ TRUYỀN THỐNG", "note": "", "ingredients": [ { "inventoryItemId": "nước-cốt-cf-phin", "name": "ml", "quantity": 30, "unit": "ml", "isMatched": false }, { "inventoryItemId": "đường-thẻ", "name": "Gói", "quantity": 1, "unit": "gói", "isMatched": false } ] },
  { "id": "prod_8", "name": "CÀ PHÊ PHIN SỮA", "category": "CÀ PHÊ TRUYỀN THỐNG", "note": "", "ingredients": [ { "inventoryItemId": "nước-cốt-cf-phin", "name": "ml", "quantity": 30, "unit": "ml", "isMatched": false }, { "inventoryItemId": "item-2", "name": "ml", "quantity": 15, "unit": "ml", "isMatched": true } ] },
  { "id": "prod_9", "name": "CÀ PHÊ ĐEN SÀI GÒN", "category": "CÀ PHÊ TRUYỀN THỐNG", "note": "", "ingredients": [ { "inventoryItemId": "nước-cốt-cf-phin", "name": "ml", "quantity": 50, "unit": "ml", "isMatched": false }, { "inventoryItemId": "đường-ngô", "name": "ml", "quantity": 10, "unit": "ml", "isMatched": false } ] },
  { "id": "prod_10", "name": "CÀ PHÊ SỮA SÀI GÒN", "category": "CÀ PHÊ TRUYỀN THỐNG", "note": "", "ingredients": [ { "inventoryItemId": "nước-cốt-cf-phin", "name": "ml", "quantity": 50, "unit": "ml", "isMatched": false }, { "inventoryItemId": "item-2", "name": "ml", "quantity": 20, "unit": "ml", "isMatched": true } ] },
  { "id": "prod_11", "name": "CÀ PHÊ TRUYỀN THỐNG (PHA PHIN LỚN)", "category": "CÀ PHÊ TRUYỀN THỐNG", "note": "1. Chuẩn bị: Tráng phin nước sôi, cho 200g cà phê vào, lắc đều.\n2. Ủ: 50ml nước sôi dưới, 150ml nước sôi trên ủ từ 10-15 phút\n3. Chiết xuất: Thêm 500ml nước sôi, đậy nắp, chờ cà phê chảy hết thu được 450ml cốt cà phê", "ingredients": [ { "inventoryItemId": "cf-vincent-roka", "name": "g", "quantity": 200, "unit": "g", "isMatched": false }, { "inventoryItemId": "nước-sôi", "name": "ml", "quantity": 700, "unit": "ml", "isMatched": false } ] },
  { "id": "prod_12", "name": "CÀ PHÊ ĐEN SG (LẮC)", "category": "CÀ PHÊ TRUYỀN THỐNG", "note": "Đong cf, đường đánh bằng máy hoặc lắc bằng bình shaker", "ingredients": [ { "inventoryItemId": "nước-cốt-cf-phin", "name": "ml", "quantity": 30, "unit": "ml", "isMatched": false }, { "inventoryItemId": "đường-thẻ", "name": "Gói", "quantity": 1, "unit": "gói", "isMatched": false } ] },
  { "id": "prod_13", "name": "CÀ PHÊ SỮA SG (LẮC)", "category": "CÀ PHÊ TRUYỀN THỐNG", "note": "Đong cf, sữa đánh bằng máy hoặc lắc bằng bình shaker", "ingredients": [ { "inventoryItemId": "nước-cốt-cf-phin", "name": "ml", "quantity": 30, "unit": "ml", "isMatched": false }, { "inventoryItemId": "item-2", "name": "ml", "quantity": 15, "unit": "ml", "isMatched": true } ] },
  { "id": "prod_14", "name": "CÀ PHÊ KEM MUỐI", "category": "CÀ PHÊ TRUYỀN THỐNG", "note": "Décor (Cacao..)", "ingredients": [ { "inventoryItemId": "nước-cốt-cf-phin", "name": "ml", "quantity": 40, "unit": "ml", "isMatched": false }, { "inventoryItemId": "item-2", "name": "ml", "quantity": 20, "unit": "ml", "isMatched": true }, { "inventoryItemId": "kem-muối", "name": "g", "quantity": 40, "unit": "g", "isMatched": false } ] },
  { "id": "prod_15", "name": "CÀ PHÊ KEM TRỨNG", "category": "CÀ PHÊ TRUYỀN THỐNG", "note": "", "ingredients": [ { "inventoryItemId": "nước-cốt-cf-phin", "name": "ml", "quantity": 40, "unit": "ml", "isMatched": false }, { "inventoryItemId": "item-2", "name": "ml", "quantity": 20, "unit": "ml", "isMatched": true }, { "inventoryItemId": "kem-trứng", "name": "g", "quantity": 40, "unit": "g", "isMatched": false } ] },
  { "id": "prod_16", "name": "CÀ PHÊ PHÔ MAI", "category": "CÀ PHÊ TRUYỀN THỐNG", "note": "Décor: cacao", "ingredients": [ { "inventoryItemId": "nước-cốt-cf-phin", "name": "ml", "quantity": 40, "unit": "ml", "isMatched": false }, { "inventoryItemId": "item-2", "name": "ml", "quantity": 20, "unit": "ml", "isMatched": true }, { "inventoryItemId": "kem-phô-mai", "name": "g", "quantity": 40, "unit": "g", "isMatched": false } ] },
  { "id": "prod_17", "name": "CÀ PHÊ CỐT DỪA", "category": "CÀ PHÊ TRUYỀN THỐNG", "note": "", "ingredients": [ { "inventoryItemId": "nước-cốt-cf-phin", "name": "ml", "quantity": 30, "unit": "ml", "isMatched": false }, { "inventoryItemId": "đường-ngô", "name": "ml", "quantity": 30, "unit": "ml", "isMatched": false }, { "inventoryItemId": "item-2", "name": "ml", "quantity": 30, "unit": "ml", "isMatched": true }, { "inventoryItemId": "cốt-dừa-vico", "name": "ml", "quantity": 30, "unit": "ml", "isMatched": false }, { "inventoryItemId": "bột-dừa-non-trendy", "name": "g", "quantity": 30, "unit": "g", "isMatched": false }, { "inventoryItemId": "đá-bi", "name": "g", "quantity": 270, "unit": "g", "isMatched": false }, { "inventoryItemId": "bột-frappe", "name": "g", "quantity": 10, "unit": "g", "isMatched": false } ] },
  { "id": "prod_18", "name": "BẠC XỈU", "category": "CÀ PHÊ TRUYỀN THỐNG", "note": "Bạc xỉu nóng thêm 80ml nước ấm", "ingredients": [ { "inventoryItemId": "item-3", "name": "ml", "quantity": 150, "unit": "ml", "isMatched": true }, { "inventoryItemId": "item-2", "name": "ml", "quantity": 20, "unit": "ml", "isMatched": true }, { "inventoryItemId": "item-1", "name": "ml", "quantity": 40, "unit": "ml", "isMatched": true } ] },
  { "id": "prod_19", "name": "TRÀ SỮA ĐẠI HỒNG BÀO", "category": "TRÀ SỮA", "note": "", "ingredients": [ { "inventoryItemId": "hồng-trà-sữa", "name": "ml", "quantity": 150, "unit": "ml", "isMatched": false }, { "inventoryItemId": "đường-ngô", "name": "ml", "quantity": 10, "unit": "ml", "isMatched": false } ] },
  { "id": "prod_20", "name": "TRÀ SỮA OLONG NHÀI", "category": "TRÀ SỮA", "note": "", "ingredients": [ { "inventoryItemId": "trà-sữa-olong-nhài", "name": "ml", "quantity": 150, "unit": "ml", "isMatched": false }, { "inventoryItemId": "đường-ngô", "name": "ml", "quantity": 10, "unit": "ml", "isMatched": false } ] },
  { "id": "prod_21", "name": "TRÀ SỮA OLONG CAO SƠN", "category": "TRÀ SỮA", "note": "", "ingredients": [ { "inventoryItemId": "trà-sữa-olong-cao-sơn", "name": "ml", "quantity": 150, "unit": "ml", "isMatched": false }, { "inventoryItemId": "đường-ngô", "name": "ml", "quantity": 10, "unit": "ml", "isMatched": false } ] },
  { "id": "prod_22", "name": "TRÀ SỮA THÁI XANH", "category": "TRÀ SỮA", "note": "", "ingredients": [ { "inventoryItemId": "trà-sữa-thái-xanh", "name": "ml", "quantity": 150, "unit": "ml", "isMatched": false }, { "inventoryItemId": "đường-ngô", "name": "ml", "quantity": 5, "unit": "ml", "isMatched": false } ] },
  { "id": "prod_23", "name": "SỮA TƯƠI TRÂN CHÂU ĐƯỜNG ĐEN", "category": "TRÀ SỮA", "note": "", "ingredients": [ { "inventoryItemId": "item-3", "name": "ml", "quantity": 150, "unit": "ml", "isMatched": true }, { "inventoryItemId": "trân-châu-đen", "name": "vá", "quantity": 1, "unit": "vá", "isMatched": false }, { "inventoryItemId": "syrup-đường-đen", "name": "ml", "quantity": 10, "unit": "ml", "isMatched": false } ] },
  { "id": "prod_24", "name": "TRÀ LỰU NĂNG NỔ", "category": "TRÀ TRÁI CÂY", "note": "Décor (Lá dứa, hạt lựu, hạt nổ củ năng): 1 Phần", "ingredients": [ { "inventoryItemId": "trà-xanh-nhài", "name": "ml", "quantity": 120, "unit": "ml", "isMatched": false }, { "inventoryItemId": "nước-cốt-lựu-dedu", "name": "ml", "quantity": 30, "unit": "ml", "isMatched": false }, { "inventoryItemId": "củ-năng-hồng", "name": "g", "quantity": 30, "unit": "g", "isMatched": false }, { "inventoryItemId": "đường-ngô", "name": "ml", "quantity": 30, "unit": "ml", "isMatched": false } ] },
  { "id": "prod_25", "name": "TRÀ ĐÀO CAM SẢ", "category": "TRÀ TRÁI CÂY", "note": "", "ingredients": [ { "inventoryItemId": "trà-đào", "name": "ml", "quantity": 120, "unit": "ml", "isMatched": false }, { "inventoryItemId": "smoothies-đào-jpt", "name": "ml", "quantity": 30, "unit": "ml", "isMatched": false }, { "inventoryItemId": "nước-cam-tươi", "name": "ml", "quantity": 30, "unit": "ml", "isMatched": false }, { "inventoryItemId": "item-4", "name": "ml", "quantity": 10, "unit": "ml", "isMatched": true }, { "inventoryItemId": "đường-ngô", "name": "ml", "quantity": 20, "unit": "ml", "isMatched": false }, { "inventoryItemId": "đào-ngâm", "name": "Miếng", "quantity": 3, "unit": "miếng", "isMatched": false } ] },
  { "id": "prod_26", "name": "TRÀ ỔI HỒNG THANH LONG ĐỎ", "category": "TRÀ TRÁI CÂY", "note": "Décor (Thanh long, lá dứa, cam vàng): 1 Phần", "ingredients": [ { "inventoryItemId": "trà-xanh-nhài", "name": "ml", "quantity": 120, "unit": "ml", "isMatched": false }, { "inventoryItemId": "mứt-ổi-ami", "name": "ml", "quantity": 40, "unit": "ml", "isMatched": false }, { "inventoryItemId": "item-4", "name": "ml", "quantity": 10, "unit": "ml", "isMatched": true }, { "inventoryItemId": "đường-nước", "name": "ml", "quantity": 15, "unit": "ml", "isMatched": false }, { "inventoryItemId": "thạch-nha-đam", "name": "g", "quantity": 30, "unit": "g", "isMatched": false } ] },
  { "id": "prod_27", "name": "TRÀ DƯA LƯỚI HOÀNG KIM", "category": "TRÀ TRÁI CÂY", "note": "Décor (lá dứa, cam vàng, chanh dây, trân châu trắng): 1 Phần", "ingredients": [ { "inventoryItemId": "trà-xanh-nhài", "name": "ml", "quantity": 120, "unit": "ml", "isMatched": false }, { "inventoryItemId": "mứt-dưa-lưới-dedu", "name": "ml", "quantity": 30, "unit": "ml", "isMatched": false }, { "inventoryItemId": "item-4", "name": "ml", "quantity": 20, "unit": "ml", "isMatched": true }, { "inventoryItemId": "đường-nước", "name": "ml", "quantity": 20, "unit": "ml", "isMatched": false }, { "inventoryItemId": "trân-châu-trắng", "name": "g", "quantity": 30, "unit": "g", "isMatched": false }, { "inventoryItemId": "chanh-dây-tươi", "name": "Quả", "quantity": 0.5, "unit": "quả", "isMatched": false } ] },
  { "id": "prod_28", "name": "TRÀ VẢI HOA HỒNG", "category": "TRÀ TRÁI CÂY", "note": "Décor (vụn hoa hồng khô, chanh lát, húng, xiên vải lon): 1 Phần", "ingredients": [ { "inventoryItemId": "trà-xanh-nhài", "name": "ml", "quantity": 120, "unit": "ml", "isMatched": false }, { "inventoryItemId": "mứt-vải-hoa-hồng-ami", "name": "ml", "quantity": 25, "unit": "ml", "isMatched": false }, { "inventoryItemId": "syrup-dâu-trendy", "name": "ml", "quantity": 10, "unit": "ml", "isMatched": false }, { "inventoryItemId": "item-4", "name": "ml", "quantity": 10, "unit": "ml", "isMatched": true }, { "inventoryItemId": "đường-ngô", "name": "ml", "quantity": 20, "unit": "ml", "isMatched": false }, { "inventoryItemId": "vải-hộp", "name": "Trái", "quantity": 2, "unit": "trái", "isMatched": false } ] },
  { "id": "prod_29", "name": "LỤC TRÀ KHỔ QUA", "category": "TRÀ TRÁI CÂY", "note": "Décor (Khổ qua, tắc, lá húng,...): 1 Phần", "ingredients": [ { "inventoryItemId": "trà-xanh-nhài", "name": "ml", "quantity": 120, "unit": "ml", "isMatched": false }, { "inventoryItemId": "smoothies-kiwi-xanh", "name": "ml", "quantity": 30, "unit": "ml", "isMatched": false }, { "inventoryItemId": "khổ-qua-tươi", "name": "g", "quantity": 30, "unit": "g", "isMatched": false }, { "inventoryItemId": "đường-ngô", "name": "ml", "quantity": 20, "unit": "ml", "isMatched": false }, { "inventoryItemId": "item-4", "name": "ml", "quantity": 10, "unit": "ml", "isMatched": true }, { "inventoryItemId": "củ-năng-trắng", "name": "g", "quantity": 30, "unit": "g", "isMatched": false } ] },
  { "id": "prod_30", "name": "MATCHA ĐÁ XAY", "category": "ĐÁ XAY", "note": "Décor (Matcha bột): 1 Phần", "ingredients": [ { "inventoryItemId": "bột-matcha-đài-loan", "name": "g", "quantity": 5, "unit": "g", "isMatched": false }, { "inventoryItemId": "item-2", "name": "ml", "quantity": 40, "unit": "ml", "isMatched": true }, { "inventoryItemId": "kem-béo-nhất-hương", "name": "ml", "quantity": 30, "unit": "ml", "isMatched": false }, { "inventoryItemId": "đường-nước", "name": "ml", "quantity": 10, "unit": "ml", "isMatched": false }, { "inventoryItemId": "item-3", "name": "ml", "quantity": 50, "unit": "ml", "isMatched": true }, { "inventoryItemId": "bột-frappe", "name": "g", "quantity": 20, "unit": "g", "isMatched": false }, { "inventoryItemId": "đá-bi", "name": "g", "quantity": 235, "unit": "g", "isMatched": false }, { "inventoryItemId": "bông-kem", "name": "Bông", "quantity": 1, "unit": "bông", "isMatched": false } ] },
  { "id": "prod_31", "name": "SÔ CÔ LA ĐÁ XAY", "category": "ĐÁ XAY", "note": "Décor (viền scl, bột scl): 1 Phần", "ingredients": [ { "inventoryItemId": "sốt-socola-trendy", "name": "ml", "quantity": 30, "unit": "ml", "isMatched": false }, { "inventoryItemId": "item-2", "name": "ml", "quantity": 35, "unit": "ml", "isMatched": true }, { "inventoryItemId": "item-3", "name": "ml", "quantity": 30, "unit": "ml", "isMatched": true }, { "inventoryItemId": "bột-frappe", "name": "g", "quantity": 10, "unit": "g", "isMatched": false }, { "inventoryItemId": "bột-socola", "name": "g", "quantity": 20, "unit": "g", "isMatched": false }, { "inventoryItemId": "kem-béo-nhất-hương", "name": "ml", "quantity": 20, "unit": "ml", "isMatched": false }, { "inventoryItemId": "đá-bi", "name": "g", "quantity": 235, "unit": "g", "isMatched": false }, { "inventoryItemId": "bông-kem", "name": "Bông", "quantity": 1, "unit": "bông", "isMatched": false } ] },
  { "id": "prod_32", "name": "SỮA CHUA XOÀI", "category": "SỮA CHUA", "note": "", "ingredients": [ { "inventoryItemId": "sữa-chua-ít-đường", "name": "Hộp", "quantity": 1, "unit": "hộp", "isMatched": false }, { "inventoryItemId": "mứt-xoài", "name": "ml", "quantity": 30, "unit": "ml", "isMatched": false }, { "inventoryItemId": "xoài-tươi", "name": "g", "quantity": 50, "unit": "g", "isMatched": false }, { "inventoryItemId": "item-2", "name": "ml", "quantity": 10, "unit": "ml", "isMatched": true }, { "inventoryItemId": "đường-ngô", "name": "ml", "quantity": 10, "unit": "ml", "isMatched": false }, { "inventoryItemId": "bột-frappe", "name": "g", "quantity": 20, "unit": "g", "isMatched": false }, { "inventoryItemId": "bông-kem", "name": "Phần", "quantity": 1, "unit": "phần", "isMatched": false } ] },
  { "id": "prod_33", "name": "SỮA CHUA DÂU", "category": "SỮA CHUA", "note": "Decor (1 quả dâu, húng lủi, mứt dâu)", "ingredients": [ { "inventoryItemId": "sữa-chua-ít-đường", "name": "Hộp", "quantity": 1, "unit": "hộp", "isMatched": false }, { "inventoryItemId": "mứt-dâu-ami", "name": "ml", "quantity": 40, "unit": "ml", "isMatched": false }, { "inventoryItemId": "đường-ngô", "name": "ml", "quantity": 10, "unit": "ml", "isMatched": false }, { "inventoryItemId": "bông-kem", "name": "Bông", "quantity": 1, "unit": "bông", "isMatched": false }, { "inventoryItemId": "item-2", "name": "ml", "quantity": 10, "unit": "ml", "isMatched": true }, { "inventoryItemId": "bột-frappe", "name": "g", "quantity": 10, "unit": "g", "isMatched": false } ] },
  { "id": "prod_34", "name": "BƠ GIÀ DỪA NON", "category": "ĐÁ XAY", "note": "", "ingredients": [ { "inventoryItemId": "thịt-bơ-tươi", "name": "g", "quantity": 100, "unit": "g", "isMatched": false }, { "inventoryItemId": "cốt-dừa-vico", "name": "ml", "quantity": 40, "unit": "ml", "isMatched": false }, { "inventoryItemId": "kem-béo-nhất-hương", "name": "ml", "quantity": 20, "unit": "ml", "isMatched": false }, { "inventoryItemId": "đường-ngô", "name": "ml", "quantity": 40, "unit": "ml", "isMatched": false }, { "inventoryItemId": "bột-dừa-non-trendy", "name": "g", "quantity": 20, "unit": "g", "isMatched": false }, { "inventoryItemId": "nước-lọc", "name": "ml", "quantity": 50, "unit": "ml", "isMatched": false }, { "inventoryItemId": "đá-bi", "name": "g", "quantity": 50, "unit": "g", "isMatched": false } ] },
  { "id": "prod_35", "name": "KHOAI MÔN CỐT DỪA", "category": "ĐÁ XAY", "note": "", "ingredients": [ { "inventoryItemId": "bột-khoai-môn-trendy", "name": "g", "quantity": 10, "unit": "g", "isMatched": false }, { "inventoryItemId": "bột-frappe", "name": "g", "quantity": 20, "unit": "g", "isMatched": false }, { "inventoryItemId": "item-2", "name": "ml", "quantity": 60, "unit": "ml", "isMatched": true }, { "inventoryItemId": "item-3", "name": "ml", "quantity": 20, "unit": "ml", "isMatched": true }, { "inventoryItemId": "cốt-dừa-vico", "name": "ml", "quantity": 60, "unit": "ml", "isMatched": false }, { "inventoryItemId": "nước-lọc", "name": "ml", "quantity": 10, "unit": "ml", "isMatched": false }, { "inventoryItemId": "đá-bi", "name": "g", "quantity": 230, "unit": "g", "isMatched": false } ] },
  { "id": "prod_36", "name": "CACAO", "category": "KHÁC", "note": "Cacao nóng thêm 50ml nước sôi", "ingredients": [ { "inventoryItemId": "bột-cacao-trendy", "name": "g", "quantity": 10, "unit": "g", "isMatched": false }, { "inventoryItemId": "kem-béo-nhất-hương", "name": "ml", "quantity": 30, "unit": "ml", "isMatched": false }, { "inventoryItemId": "item-3", "name": "ml", "quantity": 40, "unit": "ml", "isMatched": true }, { "inventoryItemId": "item-2", "name": "ml", "quantity": 30, "unit": "ml", "isMatched": true } ] },
  { "id": "prod_37", "name": "TRÀ GỪNG MẬT ONG", "category": "TRÀ NÓNG", "note": "Decor (xí muội, cam thảo, đường phèn, quế, kỉ tử): 1 Phần", "ingredients": [ { "inventoryItemId": "trà-gừng-hòa-tan-savo", "name": "Gói", "quantity": 1, "unit": "gói", "isMatched": false }, { "inventoryItemId": "gừng-tươi", "name": "g", "quantity": 10, "unit": "g", "isMatched": false }, { "inventoryItemId": "mật-ong-tam-đảo", "name": "ml", "quantity": 5, "unit": "ml", "isMatched": false } ] },
  { "id": "prod_38", "name": "NƯỚC CHANH NÓNG", "category": "TRÀ NÓNG", "note": "", "ingredients": [ { "inventoryItemId": "nước-sôi", "name": "ml", "quantity": 150, "unit": "ml", "isMatched": false }, { "inventoryItemId": "item-4", "name": "ml", "quantity": 20, "unit": "ml", "isMatched": true }, { "inventoryItemId": "đường-ngô", "name": "ml", "quantity": 30, "unit": "ml", "isMatched": false }, { "inventoryItemId": "xí-muội", "name": "cục", "quantity": 1, "unit": "cục", "isMatched": false } ] },
  { "id": "prod_39", "name": "SỮA CHUA ĐÁ", "category": "SỮA CHUA", "note": "", "ingredients": [ { "inventoryItemId": "sữa-chua-có-đường", "name": "hộp", "quantity": 1, "unit": "hộp", "isMatched": false }, { "inventoryItemId": "item-2", "name": "ml", "quantity": 20, "unit": "ml", "isMatched": true }, { "inventoryItemId": "đường-ngô", "name": "ml", "quantity": 20, "unit": "ml", "isMatched": false }, { "inventoryItemId": "item-4", "name": "ml", "quantity": 5, "unit": "ml", "isMatched": true } ] },
  { "id": "prod_40", "name": "TRÀ DƯỠNG NHAN HOA CÚC", "category": "TRÀ NÓNG", "note": "", "ingredients": [ { "inventoryItemId": "trà-túi-lọc-dưỡng-nhan", "name": "Túi", "quantity": 1, "unit": "túi", "isMatched": false }, { "inventoryItemId": "long-nhãn-khô", "name": "quả", "quantity": 3, "unit": "quả", "isMatched": false }, { "inventoryItemId": "nước-ấm", "name": "ml", "quantity": 180, "unit": "ml", "isMatched": false } ] },
  { "id": "prod_41", "name": "NƯỚC CAM TƯƠI", "category": "NƯỚC ÉP", "note": "Décor (Cam vàng, lá húng): 1 Phần", "ingredients": [ { "inventoryItemId": "nước-cam-tươi", "name": "ml", "quantity": 200, "unit": "ml", "isMatched": false }, { "inventoryItemId": "muối-tinh", "name": "g", "quantity": 0.2, "unit": "g", "isMatched": false }, { "inventoryItemId": "đường-nước", "name": "ml", "quantity": 20, "unit": "ml", "isMatched": false } ] },
  { "id": "prod_42", "name": "NƯỚC CHANH TƯƠI (ĐÁ)", "category": "NƯỚC ÉP", "note": "Décor (Chanh tươi, lá húng): 1 Phần", "ingredients": [ { "inventoryItemId": "item-4", "name": "ml", "quantity": 30, "unit": "ml", "isMatched": true }, { "inventoryItemId": "đường-ngô", "name": "ml", "quantity": 40, "unit": "ml", "isMatched": false }, { "inventoryItemId": "hạt-chia", "name": "muỗng", "quantity": 2, "unit": "muỗng", "isMatched": false }, { "inventoryItemId": "nước-lọc", "name": "ml", "quantity": 100, "unit": "ml", "isMatched": false }, { "inventoryItemId": "muối-tinh", "name": "g", "quantity": 0.2, "unit": "g", "isMatched": false } ] },
  { "id": "prod_43", "name": "NƯỚC ÉP DỨA", "category": "NƯỚC ÉP", "note": "Décor (Dứa, húng lủi): 1 Phần", "ingredients": [ { "inventoryItemId": "nước-ép-dứa", "name": "ml", "quantity": 180, "unit": "ml", "isMatched": false }, { "inventoryItemId": "đường-nước", "name": "ml", "quantity": 15, "unit": "ml", "isMatched": false }, { "inventoryItemId": "muối-tinh", "name": "g", "quantity": 0.5, "unit": "g", "isMatched": false } ] },
  { "id": "prod_44", "name": "NƯỚC ÉP CÀ RỐT", "category": "NƯỚC ÉP", "note": "Décor (cà rốt, lá húng): 1 Phần", "ingredients": [ { "inventoryItemId": "nước-ép-cà-rốt", "name": "ml", "quantity": 150, "unit": "ml", "isMatched": false }, { "inventoryItemId": "đường-nước", "name": "ml", "quantity": 20, "unit": "ml", "isMatched": false } ] },
  { "id": "prod_45", "name": "NƯỚC ÉP ỔI", "category": "NƯỚC ÉP", "note": "Décor (ổi, húng lủi): 1 Lát", "ingredients": [ { "inventoryItemId": "nước-ép-ổi-ruột-xanh", "name": "ml", "quantity": 180, "unit": "ml", "isMatched": false }, { "inventoryItemId": "đường-nước", "name": "ml", "quantity": 15, "unit": "ml", "isMatched": false }, { "inventoryItemId": "muối-tinh", "name": "g", "quantity": 0.5, "unit": "g", "isMatched": false } ] },
  { "id": "prod_46", "name": "NƯỚC ÉP CÓC", "category": "NƯỚC ÉP", "note": "Décor (Cóc tươi, húng lủi): 1 Phần", "ingredients": [ { "inventoryItemId": "nước-ép-cóc", "name": "ml", "quantity": 150, "unit": "ml", "isMatched": false }, { "inventoryItemId": "đường-nước", "name": "ml", "quantity": 30, "unit": "ml", "isMatched": false }, { "inventoryItemId": "muối-tinh", "name": "g", "quantity": 0.5, "unit": "g", "isMatched": false } ] },
  { "id": "prod_47", "name": "HỒNG TRÀ SỮA Ủ SẴN", "category": "TRÀ SỮA Ủ SẴN", "note": "Ủ trà trong 80 phút, nước sôi 100 độ, bóp nhẹ trà cho ra nước cốt trà", "ingredients": [ { "inventoryItemId": "hồng-trà-vincent", "name": "g", "quantity": 60, "unit": "g", "isMatched": false }, { "inventoryItemId": "bột-sữa-vincent", "name": "g", "quantity": 280, "unit": "g", "isMatched": false }, { "inventoryItemId": "đường-ngô", "name": "ml", "quantity": 0, "unit": "ml", "isMatched": false }, { "inventoryItemId": "item-2", "name": "ml", "quantity": 120, "unit": "ml", "isMatched": true }, { "inventoryItemId": "nước-sôi", "name": "ml", "quantity": 1300, "unit": "ml", "isMatched": false }, { "inventoryItemId": "đường-thẻ", "name": "ml", "quantity": 80, "unit": "ml", "isMatched": false } ] },
  { "id": "prod_48", "name": "LỤC TRÀ SỮA Ủ SẴN", "category": "TRÀ SỮA Ủ SẴN", "note": "Ủ trà trong 45 phút, nước sôi 100 độ", "ingredients": [ { "inventoryItemId": "trà-xanh-nhài", "name": "g", "quantity": 60, "unit": "g", "isMatched": false }, { "inventoryItemId": "bột-sữa-vincent", "name": "g", "quantity": 260, "unit": "g", "isMatched": false }, { "inventoryItemId": "item-2", "name": "ml", "quantity": 60, "unit": "ml", "isMatched": true }, { "inventoryItemId": "đường-ngô", "name": "ml", "quantity": 20, "unit": "ml", "isMatched": false }, { "inventoryItemId": "nước-sôi", "name": "ml", "quantity": 1100, "unit": "ml", "isMatched": false }, { "inventoryItemId": "nước-lọc", "name": "ml", "quantity": 200, "unit": "ml", "isMatched": false }, { "inventoryItemId": "đường-thẻ", "name": "ml", "quantity": 150, "unit": "ml", "isMatched": false } ] },
  { "id": "prod_49", "name": "TRÀ SỮA THÁI XANH Ủ SẴN", "category": "TRÀ SỮA Ủ SẴN", "note": "Ủ trà trong 30 phút, nước nóng 80 độ, bóp nhẹ trà cho ra nước cốt trà", "ingredients": [ { "inventoryItemId": "trà-thái-xanh", "name": "g", "quantity": 40, "unit": "g", "isMatched": false }, { "inventoryItemId": "bột-sữa-vincent", "name": "g", "quantity": 150, "unit": "g", "isMatched": false }, { "inventoryItemId": "item-2", "name": "ml", "quantity": 150, "unit": "ml", "isMatched": true }, { "inventoryItemId": "đường-ngô", "name": "ml", "quantity": 0, "unit": "ml", "isMatched": false }, { "inventoryItemId": "nước-sôi", "name": "ml", "quantity": 1000, "unit": "ml", "isMatched": false }, { "inventoryItemId": "đường-thẻ", "name": "ml", "quantity": 150, "unit": "ml", "isMatched": false } ] },
  { "id": "prod_50", "name": "TRÀ SỮA OLONG Ủ SẴN", "category": "TRÀ SỮA Ủ SẴN", "note": "Ủ trà trong 60 phút, nước sôi 100 độ, bóp nhẹ trà cho ra nước cốt trà", "ingredients": [ { "inventoryItemId": "trà-olong-vincent", "name": "g", "quantity": 50, "unit": "g", "isMatched": false }, { "inventoryItemId": "bột-sữa-vincent", "name": "g", "quantity": 300, "unit": "g", "isMatched": false }, { "inventoryItemId": "item-2", "name": "ml", "quantity": 60, "unit": "ml", "isMatched": true }, { "inventoryItemId": "đường-ngô", "name": "ml", "quantity": 20, "unit": "ml", "isMatched": false }, { "inventoryItemId": "nước-sôi", "name": "ml", "quantity": 1300, "unit": "ml", "isMatched": false }, { "inventoryItemId": "đường-thẻ", "name": "ml", "quantity": 120, "unit": "ml", "isMatched": false } ] },
  { "id": "prod_51", "name": "TRÀ TRÁI CÂY Ủ SẴN (TRÀ XANH NHÀI)", "category": "TRÀ Ủ SẴN", "note": "Ủ trực tiếp trà (không qua túi lọc) trong nước nóng 80–85 độ trong 7 phút", "ingredients": [ { "inventoryItemId": "trà-xanh-nhài", "name": "g", "quantity": 40, "unit": "g", "isMatched": false }, { "inventoryItemId": "nước-sôi", "name": "ml", "quantity": 1100, "unit": "ml", "isMatched": false }, { "inventoryItemId": "nước-lọc", "name": "ml", "quantity": 300, "unit": "ml", "isMatched": false }, { "inventoryItemId": "đá-bi", "name": "g", "quantity": 600, "unit": "g", "isMatched": false } ] },
  { "id": "prod_52", "name": "TRÀ ĐÀO WINDY", "category": "TRÀ Ủ SẴN", "note": "Ủ trà trong 20 phút, cân chỉnh lượng sả phù hợp, cây nhỏ có thể dùng 2.5 cây cho mỗi gói trà đào", "ingredients": [ { "inventoryItemId": "trà-đào-windy", "name": "Gói", "quantity": 3, "unit": "gói", "isMatched": false }, { "inventoryItemId": "sả-cây", "name": "Cây", "quantity": 6, "unit": "cây", "isMatched": false }, { "inventoryItemId": "nước-sôi", "name": "ml", "quantity": 1000, "unit": "ml", "isMatched": false }, { "inventoryItemId": "đá-bi", "name": "g", "quantity": 300, "unit": "g", "isMatched": false } ] },
  { "id": "prod_53", "name": "KEM TRỨNG", "category": "KEM", "note": "", "ingredients": [ { "inventoryItemId": "bột-kem-trứng-trendy", "name": "g", "quantity": 30, "unit": "g", "isMatched": false }, { "inventoryItemId": "kem-béo-nhất-hương", "name": "ml", "quantity": 150, "unit": "ml", "isMatched": false }, { "inventoryItemId": "item-3", "name": "ml", "quantity": 50, "unit": "ml", "isMatched": true }, { "inventoryItemId": "item-2", "name": "ml", "quantity": 20, "unit": "ml", "isMatched": true } ] },
  { "id": "prod_54", "name": "KEM MUỐI", "category": "KEM", "note": "", "ingredients": [ { "inventoryItemId": "kem-béo-nhất-hương", "name": "ml", "quantity": 200, "unit": "ml", "isMatched": false }, { "inventoryItemId": "sirup-caramel-trendy", "name": "ml", "quantity": 10, "unit": "ml", "isMatched": false }, { "inventoryItemId": "muối-tinh", "name": "g", "quantity": 2, "unit": "g", "isMatched": false }, { "inventoryItemId": "mật-ong-tam-đảo", "name": "ml", "quantity": 10, "unit": "ml", "isMatched": false } ] },
  { "id": "prod_55", "name": "KEM PHÔ MAI", "category": "KEM", "note": "", "ingredients": [ { "inventoryItemId": "bột-kem-phô-mai-trendy", "name": "g", "quantity": 30, "unit": "g", "isMatched": false }, { "inventoryItemId": "kem-béo-nhất-hương", "name": "ml", "quantity": 150, "unit": "ml", "isMatched": false }, { "inventoryItemId": "item-3", "name": "ml", "quantity": 50, "unit": "ml", "isMatched": true }, { "inventoryItemId": "item-2", "name": "ml", "quantity": 30, "unit": "ml", "isMatched": true } ] },
  { "id": "prod_56", "name": "TRÂN CHÂU ĐEN", "category": "TOPPINGS", "note": "B1: Đổ 2000ml nước vào nồi bấm On/Off. B2: Nồi báo → thêm trân châu và khuấy. B3: Nấu và ủ trân châu 50p. B4: Khi nồi báo End, đem trân châu ra rửa qua. B5: Thêm syrup đường đen + cốt bí đao + đường đen HQ, khuấy đều, bỏ vào nồi bấm ủ ấm.", "ingredients": [ { "inventoryItemId": "trân-châu-đen", "name": "g", "quantity": 500, "unit": "g", "isMatched": false }, { "inventoryItemId": "syrup-đường-đen", "name": "ml", "quantity": 150, "unit": "ml", "isMatched": false }, { "inventoryItemId": "đường-nâu-trendy", "name": "g", "quantity": 50, "unit": "g", "isMatched": false }, { "inventoryItemId": "bí-đao-trendy", "name": "ml", "quantity": 50, "unit": "ml", "isMatched": false }, { "inventoryItemId": "nước-sôi", "name": "ml", "quantity": 2000, "unit": "ml", "isMatched": false } ] },
  { "id": "prod_57", "name": "TRÂN CHÂU PHÔ MAI", "category": "TOPPINGS", "note": "B1: Cấp đông phô mai. B2: Chia thành 6 viên/1 cục. B3: Vo chun với bột năng. B4: Rây bột, cấp đông. B5: Lấy trân châu phô mai từ ngăn đông ra 5–10p cho rã đông, áo thêm bột năng, rây bột. B6: Nấu nước sôi, đổ trân châu vào, khi trân châu trong thì vớt ra ngâm nước đá. B7: Tỉ lệ nước đường 1–1.", "ingredients": [ { "inventoryItemId": "phô-mai-con-bò-cười", "name": "hộp", "quantity": 1, "unit": "hộp", "isMatched": false }, { "inventoryItemId": "bột-năng", "name": "gói", "quantity": 1, "unit": "gói", "isMatched": false } ] }
]

export const initialGlobalUnits: GlobalUnit[] = [
    { id: 'ml', name: 'ml' },
    { id: 'g', name: 'g' },
    { id: 'kg', name: 'kg' },
    { id: 'l', name: 'l' },
    { id: 'cái', name: 'cái' },
    { id: 'hộp', name: 'hộp' },
    { id: 'thùng', name: 'thùng' },
    { id: 'gói', name: 'gói' },
    { id: 'viên', name: 'viên' },
    { id: 'bình', name: 'bình' },
    { id: 'cây', name: 'cây' },
    { id: 'quả', name: 'quả' },
    { id: 'lát', name: 'lát' },
    { id: 'phần', name: 'phần' },
    { id: 'lon', name: 'lon' },
];
    
    
    
