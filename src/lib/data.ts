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
            { id: 'sang-4', text: 'Đảm bảo WC T1 sạch, thơm, bồn tiểu, bồn cầu sạch', isCritical: true },
            { id: 'sang-5', text: 'Đảm bảo WC T2 sạch, thơm, bồn tiểu, bồn cầu sạch', isCritical: true },
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
                { id: 'toi-4', text: 'Đảm bảo trà nước của khách luôn đầy đủ' },
                { id: 'toi-5', text: 'Đảm bảo trà nước tự phục vụ T2 luôn sẵn sàng' },
                { id: 'toi-6', text: 'Đảm bảo WC T1 sạch, thơm, bồn tiểu, bồn cầu sạch', isCritical: true },
                { id: 'toi-7', text: 'Đảm bảo WC T2 sạch, thơm, bồn tiểu, bồn cầu sạch', isCritical: true },
            ]
        },
        {
            title: 'Trong ca',
            tasks: [
                { id: 'toi-8', text: 'Đảm bảo khu vực khách về đã được dọn sạch sẽ' },
                { id: 'toi-9', text: 'Đảm bảo các bao rác đầy đều đã được thay' },
                { id: 'toi-10', text: 'Đảm bảo sàn nhà T1, cầu thang sạch sẽ' },
                { id: 'toi-11', text: 'Đảm bảo sàn nhà, sân T2 sạch sẽ' },
                { id: 'toi-12', text: 'Đảm bảo WC 2 tầng sạch, thơm, bồn tiểu, bồn cầu sạch' },
                { id: 'toi-13', text: 'Đảm bảo các ghế dù đều sạch, hoặc đều được rửa' },
                { id: 'toi-14', text: 'Đảm bảo sân tầng 1 đã được dội nước hết các vết bẩn' },
            ]
        },
        {
            title: 'Cuối ca',
            tasks: [
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
