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
          { id: 'sang-1', text: 'Đảm bảo trà nước của khách luôn đầy đủ', timeSlots: ['08:00', '10:00', '12:00'] },
          { id: 'sang-2', text: 'Đảm bảo trà nước tự phục vụ T2 luôn sẵn sàng', timeSlots: ['08:00', '10:00', '12:00'] },
          { id: 'sang-3', text: 'Đảm bảo các cửa kính đã được lau sạch sẽ', timeSlots: ['07:30'] },
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
            { id: 'sang-6', text: 'Đảm bảo khu vực không có khách đã được dọn sạch sẽ, cả trên mặt bàn lẫn dưới đất, bàn ghế sắp xếp gọn gàng', timeSlots: ['12:30'] },
            { id: 'sang-7', text: 'Đảm bảo các bao rác đầy đều đã được thay', timeSlots: ['12:30'] },
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
                { id: 'trua-1', text: 'Đảm bảo khu vực không có khách đã được dọn sạch sẽ, cả trên mặt bàn lẫn dưới đất, bàn ghế sắp xếp gọn gàng', timeSlots: ['13:00'] },
                { id: 'trua-2', text: 'Đảm bảo các ghế dù đều sạch, hoặc đều được rửa', timeSlots: ['13:00'] },
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
                { id: 'trua-4', text: 'Đảm bảo ly trà đã được rửa đầy đủ, xếp chồng kiểu tháp để nước trong ly chảy ra, chấm công ra', timeSlots: ['17:30'] },
                { id: 'trua-5', text: 'Đảm bảo đèn đã được bật đúng', timeSlots: ['17:30'] },
                { id: 'trua-6', text: 'Đảm bảo các chậu cây đã được tưới', timeSlots: ['17:30'] },
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
                { id: 'toi-1', text: 'Đảm bảo rèm che nắng cửa kính trong nhà đã được kéo lên (chỉ kéo khu vực không có khách)', timeSlots: ['18:00'] },
                { id: 'toi-2', text: 'Đảm bảo bạt đã kéo vào, tất cả dù đã được thu về', timeSlots: ['18:00'] },
                { id: 'toi-3', text: 'Đảm bảo các cửa kính đã được lau sạch sẽ', timeSlots: ['18:00'] },
                { id: 'toi-4', text: 'Đảm bảo trà nước của khách luôn đầy đủ', timeSlots: ['18:00', '20:00'] },
                { id: 'toi-5', text: 'Đảm bảo trà nước tự phục vụ T2 luôn sẵn sàng', timeSlots: ['18:00', '20:00'] },
                { id: 'toi-6', text: 'Đảm bảo WC T1 sạch, thơm, bồn tiểu, bồn cầu sạch', isCritical: true, timeSlots: ['18:00', '20:00'] },
                { id: 'toi-7', text: 'Đảm bảo WC T2 sạch, thơm, bồn tiểu, bồn cầu sạch', isCritical: true, timeSlots: ['18:00', '20:00'] },
            ]
        },
        {
            title: 'Trong ca',
            tasks: [
                { id: 'toi-8', text: 'Đảm bảo khu vực khách về đã được dọn sạch sẽ', timeSlots: ['19:00', '21:00'] },
                { id: 'toi-9', text: 'Đảm bảo các bao rác đầy đều đã được thay', timeSlots: ['21:30'] },
                { id: 'toi-10', text: 'Đảm bảo sàn nhà T1, cầu thang sạch sẽ', timeSlots: ['21:30'] },
                { id: 'toi-11', text: 'Đảm bảo sàn nhà, sân T2 sạch sẽ', timeSlots: ['21:30'] },
                { id: 'toi-12', text: 'Đảm bảo WC 2 tầng sạch, thơm, bồn tiểu, bồn cầu sạch', timeSlots: ['21:30'] },
                { id: 'toi-13', text: 'Đảm bảo các ghế dù đều sạch, hoặc đều được rửa', timeSlots: ['21:30'] },
                { id: 'toi-14', text: 'Đảm bảo sân tầng 1 đã được dội nước hết các vết bẩn', timeSlots: ['21:30'] },
            ]
        },
        {
            title: 'Cuối ca',
            tasks: [
                { id: 'toi-15', text: 'Đảm bảo dụng cụ vệ sinh đã được mang vào nhà, thùng rác đã được đặt đúng chỗ', timeSlots: ['22:00'] },
                { id: 'toi-16', text: 'Đảm bảo ly trà đã được rửa đầy đủ, xếp chồng kiểu tháp để nước trong ly chảy ra', timeSlots: ['22:00'] },
                { id: 'toi-17', text: 'Đảm bảo thùng tách nước, thùng lau nhà sạch', timeSlots: ['22:00'] },
                { id: 'toi-18', text: 'Đảm bảo các bao rác có rác đã được thay thế', timeSlots: ['22:00'] },
                { id: 'toi-19', text: 'Tiến hành xịt muỗi khi thấy trong nhà có muỗi', timeSlots: ['22:00'] },
                { id: 'toi-20', text: 'Đảm bảo các thiết bị điện cần tắt đã được tắt', timeSlots: ['22:15'] },
            ]
        }
    ],
  },
};


export const reports: ShiftReport[] = [
  {
    id: 'report-001',
    staffName: 'Jane Doe',
    shiftDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    completedTasks: ['task-1', 'task-2', 'task-3', 'task-4', 'task-5', 'task-6', 'task-7'],
    uploadedPhotos: [
      'https://picsum.photos/600/400?random=1',
      'https://picsum.photos/600/400?random=2',
      'https://picsum.photos/600/400?random=3',
    ],
    issues: 'The coffee machine in the break room was leaking again. Placed a bucket underneath.',
  },
  {
    id: 'report-002',
    staffName: 'John Smith',
    shiftDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    completedTasks: ['task-1', 'task-3', 'task-5', 'task-6'],
    uploadedPhotos: [
        'https://picsum.photos/600/400?random=4',
        'https://picsum.photos/600/400?random=5',
    ],
    issues: 'Ran out of cleaning spray for the restrooms. Had to use soap and water.',
  },
  {
    id: 'report-003',
    staffName: 'Emily White',
    shiftDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    completedTasks: ['task-1', 'task-2', 'task-3', 'task-4', 'task-5', 'task-6', 'task-7'],
    uploadedPhotos: [
        'https://picsum.photos/600/400?random=6',
        'https://picsum.photos/600/400?random=7',
        'https://picsum.photos/600/400?random=8',
        'https://picsum.photos/600/400?random=9',
    ],
    issues: null,
  },
];
