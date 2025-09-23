import type { TimeSlot, TasksByShift, TaskSection, InventoryItem, ComprehensiveTaskSection, Suppliers, ViolationCategory, OtherCostCategory } from './types';
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


export const defaultTimeSlots: TimeSlot[] = [
    { start: '05:30', end: '12:00' },
    { start: '12:00', end: '17:00' },
    { start: '17:00', end: '23:00' },
];

    
