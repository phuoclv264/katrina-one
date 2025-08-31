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
            { id: 'sang-4', text: 'Đảm bảo WC T1 sạch, thơm, bồn tiểu, bồn cầu sạch', isCritical: true, timeSlots: ['08:00', '10:00', '12:00'] },
            { id: 'sang-5', text: 'Đảm bảo WC T2 sạch, thơm, bồn tiểu, bồn cầu sạch', isCritical: true, timeSlots: ['08:00', '10:00', '12:00'] },
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
                { id: 'trua-3', text: 'Đảm bảo thùng tách nước, thùng lau nhà đã được dọn sạch, các bao rác đã được kiểm tra, thay thế', timeSlots: ['15:00', '17:00'] },
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
                { id: 'toi-4', text: 'Đảm bảo trà nước của khách luôn đầy đủ', timeSlots: ['18:00', '20:00'] },
                { id: 'toi-5', text: 'Đảm bảo trà nước tự phục vụ T2 luôn sẵn sàng', timeSlots: ['18:00', '20:00'] },
                { id: 'toi-6', text: 'Đảm bảo WC T1 sạch, thơm, bồn tiểu, bồn cầu sạch', isCritical: true, timeSlots: ['18:00', '20:00'] },
                { id: 'toi-7', text: 'Đảm bảo WC T2 sạch, thơm, bồn tiểu, bồn cầu sạch', isCritical: true, timeSlots: ['18:00', '20:00'] },
                { id: 'toi-8', text: 'Đảm bảo khu vực khách về đã được dọn sạch sẽ', timeSlots: ['19:00', '21:00'] },
            ]
        },
        {
            title: 'Cuối ca',
            tasks: [
                { id: 'toi-9', text: 'Đảm bảo các bao rác đầy đều đã được thay' },
                { id: 'toi-10', text: 'Đảm bảo sàn nhà T1, cầu thang sạch sẽ' },
                { id: 'toi-11', text: 'Đảm bảo sàn nhà, sân T2 sạch sẽ' },
                { id: 'toi-12', text: 'Đảm bảo WC 2 tầng sạch, thơm, bồn tiểu, bồn cầu sạch' },
                { id: 'toi-13', text: 'Đảm bảo các ghế dù đều sạch, hoặc đều được rửa' },
                { id: 'toi-14', text: 'Đảm bảo sân tầng 1 đã được dội nước hết các vết bẩn' },
                { id: 'toi-15', text: 'Đảm bảo dụng cụ vệ sinh đã được mang vào nhà, thùng rác đã được đặt đúng chỗ' },
                { id: 'toi-16', text: 'Đảm bảo ly trà đã được rửa đầy đủ, xếp chồng kiểu tháp để nước trong ly chảy ra' },
                { id: 'toi-17', text: 'Đảm bảo thùng tách nước, thùng lau nhà sạch' },
                { id: 'toi-18', text: 'Đảm bảo các bao rác có rác đã được thay thế' },
                { id: 'toi-19', text: 'Tiến hành xịt muỗi khi thấy trong nhà có muỗi' },
                { id: 'toi-20', text: 'Đảm bảo các thiết bị điện cần tắt đã được tắt' },
            ]
        }
    ],
  },
};


export const reports: ShiftReport[] = [
  {
    id: 'report-001',
    shiftKey: 'sang',
    staffName: 'Jane Doe',
    shiftDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    completedTasks: {
        'sang-1': true,
        'sang-2': true,
        'sang-3': true,
        'sang-4': { '08:00': true, '10:00': true, '12:00': true },
        'sang-5': { '08:00': true, '10:00': true, '12:00': true },
        'sang-6': true,
        'sang-7': true,
    },
    uploadedPhotos: [
      'https://picsum.photos/600/400?random=1',
      'https://picsum.photos/600/400?random=2',
      'https://picsum.photos/600/400?random=3',
    ],
    issues: 'The coffee machine in the break room was leaking again. Placed a bucket underneath.',
  },
  {
    id: 'report-002',
    shiftKey: 'trua',
    staffName: 'John Smith',
    shiftDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    completedTasks: {
        'trua-1': true,
        'trua-2': false,
        'trua-3': { '15:00': true, '17:00': false },
        'trua-4': true,
        'trua-5': true,
        'trua-6': false,
    },
    uploadedPhotos: [
        'https://picsum.photos/600/400?random=4',
        'https://picsum.photos/600/400?random=5',
    ],
    issues: 'Ran out of cleaning spray for the restrooms. Had to use soap and water.',
  },
  {
    id: 'report-003',
    shiftKey: 'toi',
    staffName: 'Emily White',
    shiftDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    completedTasks: {
        'toi-1': true,
        'toi-2': true,
        'toi-3': true,
        'toi-4': { '18:00': true, '20:00': true },
        'toi-5': { '18:00': true, '20:00': true },
        'toi-6': { '18:00': true, '20:00': true },
        'toi-7': { '18:00': true, '20:00': true },
        'toi-8': { '19:00': true, '21:00': true },
        'toi-9': true,
        'toi-10': true,
        'toi-11': true,
        'toi-12': true,
        'toi-13': true,
        'toi-14': true,
        'toi-15': true,
        'toi-16': true,
        'toi-17': true,
        'toi-18': true,
        'toi-19': true,
        'toi-20': true,
    },
    uploadedPhotos: [
        'https://picsum.photos/600/400?random=6',
        'https://picsum.photos/600/400?random=7',
        'https://picsum.photos/600/400?random=8',
        'https://picsum.photos/600/400?random=9',
    ],
    issues: null,
  },
];
