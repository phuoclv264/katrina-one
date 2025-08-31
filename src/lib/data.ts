import type { ShiftReport, Task, TasksByShift } from './types';

export const tasks: Task[] = [
  { id: 'task-1', text: 'Clean front entrance and welcome mat' },
  { id: 'task-2', text: 'Wipe down all tables and chairs', isCritical: true },
  { id: 'task-3', text: 'Restock napkins and condiments' },
  { id: 'task-4', text: 'Clean and sanitize restrooms', isCritical: true },
  { id: 'task-5', text: 'Empty all trash bins and replace liners' },
  { id: 'task-6', text: 'Sweep and mop all floors' },
  { id: 'task-7', text: 'Check and report any equipment malfunctions' },
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
            { id: 'sang-4', text: 'Đảm bảo WC T1 sạch, thơm, bồn tiểu, bồn cầu sạch', timeSlots: true },
            { id: 'sang-5', text: 'Đảm bảo WC T2 sạch, thơm, bồn tiểu, bồn cầu sạch', timeSlots: true },
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
                { id: 'trua-3', text: 'Đảm bảo thùng tách nước, thùng lau nhà đã được dọn sạch, các bao rác đã được kiểm tra, thay thế', timeSlots: true },
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
                { id: 'toi-4', text: 'Đảm bảo trà nước của khách luôn đầy đủ', timeSlots: true },
                { id: 'toi-5', text: 'Đảm bảo trà nước tự phục vụ T2 luôn sẵn sàng', timeSlots: true },
                { id: 'toi-6', text: 'Đảm bảo WC T1 sạch, thơm, bồn tiểu, bồn cầu sạch', timeSlots: true },
                { id: 'toi-7', text: 'Đảm bảo WC T2 sạch, thơm, bồn tiểu, bồn cầu sạch', timeSlots: true },
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

export const reports: ShiftReport[] = [
  {
    id: 'report-1',
    staffName: 'Alice',
    shiftDate: '2024-07-22',
    completedTasks: { 'sang-1': true, 'sang-2': true, 'sang-3': false, 'sang-4': ['08:00', '10:00'], 'sang-5': ['09:00'] },
    uploadedPhotos: [],
    issues: 'Khách hàng phàn nàn về wifi chậm.',
    shiftKey: 'sang',
  },
  {
    id: 'report-2',
    staffName: 'Bob',
    shiftDate: '2024-07-22',
    completedTasks: { 'trua-1': true, 'trua-2': true, 'trua-3': ['14:00', '16:00'], 'trua-4': true, 'trua-5': true, 'trua-6': false },
    uploadedPhotos: [],
    issues: null,
    shiftKey: 'trua',
  },
  {
    id: 'report-3',
    staffName: 'Charlie',
    shiftDate: '2024-07-21',
    completedTasks: { 'toi-1': true, 'toi-2': true, 'toi-3': true, 'toi-4': ['19:00', '21:00'], 'toi-5': ['20:00'], 'toi-6': ['18:30'], 'toi-7': ['20:30'], 'toi-8': true, 'toi-9': true, 'toi-10': true, 'toi-11': true },
    uploadedPhotos: [],
    issues: 'Hết giấy in hóa đơn.',
    shiftKey: 'toi',
  }
];
