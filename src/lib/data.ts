
import type { ShiftReport, Task, TasksByShift, Staff, TaskSection, InventoryItem } from './types';

export const staff: Staff[] = [
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
          { id: 'sang-1', text: 'Đảm bảo trà nước của khách luôn đầy đủ' },
          { id: 'sang-2', text: 'Đảm bảo trà nước tự phục vụ T2 luôn sẵn sàng' },
          { id: 'sang-3', text: 'Đảm bảo các cửa kính đã được lau sạch sẽ' },
        ],
      },
      {
        title: 'Trong ca',
        tasks: [
            { id: 'sang-4', text: 'Đảm bảo WC T1 sạch, thơm, bồn tiểu, bồn cầu sạch' },
            { id: 'sang-5', text: 'Đảm bảo WC T2 sạch, thơm, bồn tiểu, bồn cầu sạch' },
        ]
      },
      {
        title: 'Cuối ca',
        tasks: [
            { id: 'sang-6', text: 'Đảm bảo khu vực không có khách đã được dọn sạch sẽ, cả trên mặt bàn lẫn dưới đất, bàn ghế sắp xếp gọn gàng' },
            { id: 'sang-7', text: 'Đảm bảo các bao rác đầy đều đã được thay' },
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
                { id: 'trua-1', text: 'Đảm bảo khu vực không có khách đã được dọn sạch sẽ, cả trên mặt bàn lẫn dưới đất, bàn ghế sắp xếp gọn gàng' },
                { id: 'trua-2', text: 'Đảm bảo các ghế dù đều sạch, hoặc đều được rửa' },
            ]
        },
        {
            title: 'Trong ca',
            tasks: [
                { id: 'trua-3', text: 'Đảm bảo thùng tách nước, thùng lau nhà đã được dọn sạch, các bao rác đã được kiểm tra, thay thế' },
            ]
        },
        {
            title: 'Cuối ca',
            tasks: [
                { id: 'trua-4', text: 'Đảm bảo ly trà đã được rửa đầy đủ, xếp chồng kiểu tháp để nước trong ly chảy ra, chấm công ra' },
                { id: 'trua-5', text: 'Đảm bảo đèn đã được bật đúng' },
                { id: 'trua-6', text: 'Đảm bảo các chậu cây đã được tưới' },
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
                { id: 'toi-1', text: 'Đảm bảo rèm che nắng cửa kính trong nhà đã được kéo lên (chỉ kéo khu vực không có khách)' },
                { id: 'toi-2', text: 'Đảm bảo bạt đã kéo vào, tất cả dù đã được thu về' },
                { id: 'toi-3', text: 'Đảm bảo các cửa kính đã được lau sạch sẽ' },
            ]
        },
        {
            title: 'Trong ca',
            tasks: [
                { id: 'toi-4', text: 'Đảm bảo trà nước của khách luôn đầy đủ' },
                { id: 'toi-5', text: 'Đảm bảo trà nước tự phục vụ T2 luôn sẵn sàng' },
                { id: 'toi-6', text: 'Đảm bảo WC T1 sạch, thơm, bồn tiểu, bồn cầu sạch' },
                { id: 'toi-7', text: 'Đảm bảo WC T2 sạch, thơm, bồn tiểu, bồn cầu sạch' },
            ]
        },
        {
            title: 'Cuối ca',
            tasks: [
                { id: 'toi-8', text: 'Đảm bảo ly trà đã được rửa đầy đủ, xếp chồng kiểu tháp để nước trong ly chảy ra, chấm công ra' },
                { id: 'toi-9', text: 'Đảm bảo đèn đã được bật đúng' },
                { id: 'toi-10', text: 'Đảm bảo các chậu cây đã được tưới' },
                { id: 'toi-11', text: 'Đảm bảo các bao rác đầy đều đã được thay' }
            ]
        }
    ],
  },
};

export const bartenderTasks: TaskSection[] = [
    {
        title: 'Vệ sinh khu vực pha chế',
        tasks: [
            { id: 'bt-1', text: 'Lau dọn sạch sẽ bề mặt quầy bar' },
            { id: 'bt-2', text: 'Sắp xếp gọn gàng các chai siro, nguyên liệu' },
            { id: 'bt-3', text: 'Vệ sinh bồn rửa, đảm bảo không có rác tồn đọng' },
        ]
    },
    {
        title: 'Vệ sinh dụng cụ',
        tasks: [
            { id: 'bt-4', text: 'Rửa sạch và lau khô các loại ly, cốc' },
            { id: 'bt-5', text: 'Vệ sinh shaker, jigger và các dụng cụ pha chế khác' },
            { id: 'bt-6', text: 'Tráng và úp ráo các ca đong, bình ủ trà' },
        ]
    },
    {
        title: 'Vệ sinh thiết bị',
        tasks: [
            { id: 'bt-7', text: 'Vệ sinh máy pha cà phê: họng pha, tay cầm, vòi đánh sữa' },
            { id: 'bt-8', text: 'Lau chùi bên ngoài tủ lạnh, tủ mát, tủ đông' },
            { id: 'bt-9', text: 'Vệ sinh máy xay sinh tố, đảm bảo cối xay sạch sẽ' },
        ]
    }
];

export const inventoryList: InventoryItem[] = [
  { id: 'item-1', name: 'TOPPING - Đào Ngâm Thái Lan Dedu (12 hộp/thùng, 820gram/hộp)', unit: 'lon', minStock: 1, orderSuggestion: '4' },
  { id: 'item-2', name: 'TOPPING - Hạt nổ củ năng Hồng dạng hũ', unit: 'hộp', minStock: 2, orderSuggestion: '5' },
  { id: 'item-3', name: 'TOPPING - Hạt Nổ Củ Năng Trắng Dedu (12 hộp/thùng, 900gram/hộp)', unit: 'hộp', minStock: 1, orderSuggestion: '2' },
  { id: 'item-4', name: 'TOPPING - Thạch Nha đam Trendy 1000GR', unit: 'gói', minStock: 1, orderSuggestion: '2' },
  { id: 'item-5', name: 'TOPPING - Trân châu đen Trendy 1000GR', unit: 'túi', minStock: 2, orderSuggestion: '2' },
  { id: 'item-6', name: 'TOPPING - Vải ngâm Fresko 565GR', unit: 'hộp', minStock: 2, orderSuggestion: '4' },
  { id: 'item-7', name: 'TOPPING - Vụn Dừa Nướng 1Kg - Coconut Jinnija', unit: 'gói', minStock: 1, orderSuggestion: '1' },
  { id: 'item-8', name: 'TOPPING - Xí muội', unit: 'gói', minStock: 1, orderSuggestion: '1' },
  { id: 'item-9', name: 'TRÁI CÂY - Bơ cấp đông', unit: 'gói', minStock: 10, orderSuggestion: '5kg' },
  { id: 'item-10', name: 'TRÁI CÂY - Cà rốt', unit: 'trái', minStock: 5, orderSuggestion: '5kg' },
  { id: 'item-11', name: 'TRÁI CÂY - Cam décor', unit: 'trái', minStock: 2, orderSuggestion: '2kg' },
  { id: 'item-12', name: 'TRÁI CÂY - Cam xanh', unit: 'trái', minStock: 20, orderSuggestion: '10kg' },
  { id: 'item-13', name: 'TRÁI CÂY - Chanh dây', unit: 'trái', minStock: 10, orderSuggestion: '1-2kg' },
  { id: 'item-14', name: 'TRÁI CÂY - Chanh décor', unit: 'trái', minStock: 4, orderSuggestion: '1kg' },
  { id: 'item-15', name: 'TRÁI CÂY - Cóc non', unit: 'gr', minStock: 1, orderSuggestion: '3kg' },
  { id: 'item-16', name: 'TRÁI CÂY - Gừng', unit: 'củ', minStock: 1, orderSuggestion: '2' },
  { id: 'item-17', name: 'TRÁI CÂY - Khổ qua', unit: 'trái', minStock: 1, orderSuggestion: '1' },
  { id: 'item-18', name: 'TRÁI CÂY - Ổi trắng', unit: 'trái', minStock: 10, orderSuggestion: '5kg' },
  { id: 'item-19', name: 'TRÁI CÂY - Sả', unit: 'cây', minStock: 10, orderSuggestion: '1 bó' },
  { id: 'item-20', name: 'TRÁI CÂY - Thanh long đỏ', unit: 'trái', minStock: 1, orderSuggestion: '1' },
  { id: 'item-21', name: 'TRÁI CÂY - Thơm', unit: 'trái', minStock: 2, orderSuggestion: '5' },
  { id: 'item-22', name: 'TRÁI CÂY - Xoài cấp đông', unit: 'gói', minStock: 10, orderSuggestion: '1-2kg' },
  { id: 'item-23', name: 'DECOR - Lá dứa', unit: 'bó', minStock: 0.5, orderSuggestion: '1' },
  { id: 'item-24', name: 'DECOR - Lá húng', unit: 'bó', minStock: 0.5, orderSuggestion: '1' },
  { id: 'item-25', name: 'DECOR - Nụ hồng khô 50gram', unit: 'gói', minStock: 0.2, orderSuggestion: '1' },
  { id: 'item-26', name: 'GIA VỊ - Đường ăn kiêng', unit: 'hộp', minStock: 0.5, orderSuggestion: '1' },
  { id: 'item-27', name: 'GIA VỊ - Đường que Biên Hòa', unit: 'gói', minStock: 2, orderSuggestion: '5' },
  { id: 'item-28', name: 'GIA VỊ - Long nhãn khô', unit: 'gr', minStock: 100, orderSuggestion: '100' },
  { id: 'item-29', name: 'GIA VỊ - Muối tinh', unit: 'gói', minStock: 0.3, orderSuggestion: '1' },
  { id: 'item-30', name: 'THỨC ĂN - Hạt dưa', unit: 'gói', minStock: 10, orderSuggestion: '40' },
  { id: 'item-31', name: 'THỨC ĂN - Hạt hướng dương', unit: 'gói', minStock: 10, orderSuggestion: '40' },
  { id: 'item-32', name: 'LY - Ly giấy 270ml (không được hết, chú ý kiểm tra thường xuyên)', unit: 'cây', minStock: 5, orderSuggestion: '5' },
  { id: 'item-33', name: 'LY - Ly nhựa 350ml (không được hết, chú ý kiểm tra thường xuyên)', unit: 'cây', minStock: 10, orderSuggestion: '10' },
  { id: 'item-34', name: 'LY - Ly nhựa 500ml (không được hết, chú ý kiểm tra thường xuyên)', unit: 'cây', minStock: 10, orderSuggestion: '10' },
  { id: 'item-35', name: 'CCDC - Dĩa sứ lớn', unit: 'dĩa', minStock: 0, orderSuggestion: '0' },
  { id: 'item-36', name: 'CCDC - Dĩa sứ nhỏ', unit: 'dĩa', minStock: 0, orderSuggestion: '0' },
  { id: 'item-37', name: 'CCDC - Ly đựng sữa', unit: 'ly', minStock: 0, orderSuggestion: '0' },
  { id: 'item-38', name: 'CCDC - Ly sứ 200ml', unit: 'ly', minStock: 0, orderSuggestion: '0' },
  { id: 'item-39', name: 'CCDC - Ly sứ 90ml', unit: 'ly', minStock: 0, orderSuggestion: '0' },
  { id: 'item-40', name: 'CCDC - Ly thuỷ tinh 90ml', unit: 'ly', minStock: 0, orderSuggestion: '0' },
  { id: 'item-41', name: 'CCDC - Ly trà inox 1 lớp 350ml', unit: 'ly', minStock: 35, orderSuggestion: '35' },
  { id: 'item-42', name: 'CCDC - Ly trà inox 2 lớp 170ml', unit: 'ly', minStock: 150, orderSuggestion: '150' },
  { id: 'item-43', name: 'DCVS - Chổi quét sân', unit: 'cây', minStock: 1, orderSuggestion: '1' },
  { id: 'item-44', name: 'DCVS - Giấy ăn Gumi', unit: 'gói', minStock: 20, orderSuggestion: '20' },
  { id: 'item-45', name: 'DCVS - Giấy vệ sinh cuộn lớn', unit: 'cuộn', minStock: 5, orderSuggestion: '5' },
];
