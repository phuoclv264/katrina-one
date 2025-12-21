'use client';

import React, { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { UserMultiSelect } from '@/components/user-multi-select';
import type { ScheduleCondition, ShiftTemplate, ManagedUser, UserRole } from '@/lib/types';

type ConditionType = 'WorkloadLimit' | 'DailyShiftLimit' | 'ShiftStaffing' | 'StaffPriority' | 'StaffShiftLink' | 'StaffExclusion' | 'AvailabilityStrictness';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  conditionType?: ConditionType;
  shiftTemplates: ShiftTemplate[];
  allUsers: ManagedUser[];
  onAddCondition: (condition: ScheduleCondition) => void;
  onSaveCondition?: (condition: ScheduleCondition) => void;
  conditionToEdit?: ScheduleCondition | null;
};

export default function AddConditionSheet({
  isOpen,
  onClose,
  conditionType,
  shiftTemplates,
  allUsers,
  onAddCondition,
  onSaveCondition,
  conditionToEdit,
}: Props) {
  const [type, setType] = useState<ConditionType>(conditionType || 'WorkloadLimit');
  const [selectedUser, setSelectedUser] = useState<ManagedUser[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [scope, setScope] = useState<'global' | 'user'>('global');
  const [minShifts, setMinShifts] = useState('');
  const [maxShifts, setMaxShifts] = useState('');
  const [minHours, setMinHours] = useState('');
  const [maxHours, setMaxHours] = useState('');
  const [maxDaily, setMaxDaily] = useState('');
  const [staffingRole, setStaffingRole] = useState<UserRole | 'Bất kỳ'>('Bất kỳ');
  const [staffingCount, setStaffingCount] = useState('1');
  const [staffingMandatory, setStaffingMandatory] = useState(false);
  const [priorityWeight, setPriorityWeight] = useState('1');
  const [priorityMandatory, setPriorityMandatory] = useState(false);
  const [linkType, setLinkType] = useState<'force' | 'ban'>('force');
  const [blockedUsers, setBlockedUsers] = useState<ManagedUser[]>([]);
  const [availabilityStrict, setAvailabilityStrict] = useState(false);

  useEffect(() => {
    if (conditionToEdit) {
      setType(conditionToEdit.type as ConditionType);
      switch (conditionToEdit.type) {
        case 'WorkloadLimit': {
          const wl = conditionToEdit as any;
          setScope(wl.scope);
          setSelectedUser(wl.scope === 'user' ? allUsers.filter(u => u.uid === wl.userId) : []);
          setMinShifts(wl.minShiftsPerWeek != null ? String(wl.minShiftsPerWeek) : '');
          setMaxShifts(wl.maxShiftsPerWeek != null ? String(wl.maxShiftsPerWeek) : '');
          setMinHours(wl.minHoursPerWeek != null ? String(wl.minHoursPerWeek) : '');
          setMaxHours(wl.maxHoursPerWeek != null ? String(wl.maxHoursPerWeek) : '');
          break;
        }
        case 'DailyShiftLimit': {
          const dl = conditionToEdit as any;
          setSelectedUser(dl.userId ? allUsers.filter(u => u.uid === dl.userId) : []);
          setMaxDaily(dl.maxPerDay != null ? String(dl.maxPerDay) : '');
          break;
        }
        case 'ShiftStaffing': {
          const ss = conditionToEdit as any;
          setSelectedTemplate(ss.templateId || '');
          setStaffingRole(ss.role);
          setStaffingCount(ss.count != null ? String(ss.count) : '1');
          setStaffingMandatory(!!ss.mandatory);
          break;
        }
        case 'StaffPriority': {
          const sp = conditionToEdit as any;
          setSelectedUser(allUsers.filter(u => u.uid === sp.userId));
          setSelectedTemplate(sp.templateId || '');
          setPriorityWeight(sp.weight != null ? String(sp.weight) : '1');
          setPriorityMandatory(!!sp.mandatory);
          break;
        }
        case 'StaffShiftLink': {
          const sl = conditionToEdit as any;
          setSelectedUser(allUsers.filter(u => u.uid === sl.userId));
          setSelectedTemplate(sl.templateId || '');
          setLinkType(sl.link);
          break;
        }
        case 'StaffExclusion': {
          const se = conditionToEdit as any;
          setSelectedUser(allUsers.filter(u => u.uid === se.userId));
          setBlockedUsers(allUsers.filter(u => (se.blockedUserIds || []).includes(u.uid)));
          setSelectedTemplate(se.templateId || '');
          break;
        }
        case 'AvailabilityStrictness': {
          const av = conditionToEdit as any;
          setAvailabilityStrict(!!av.strict);
          break;
        }
        default:
          break;
      }
    } else {
      resetForm();
      setType(conditionType || 'WorkloadLimit');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conditionToEdit, allUsers, conditionType]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setSelectedUser([]);
    setSelectedTemplate('');
    setScope('global');
    setMinShifts('');
    setMaxShifts('');
    setMinHours('');
    setMaxHours('');
    setMaxDaily('');
    setStaffingRole('Bất kỳ');
    setStaffingCount('1');
    setStaffingMandatory(false);
    setPriorityWeight('1');
    setPriorityMandatory(false);
    setLinkType('force');
    setBlockedUsers([]);
    setAvailabilityStrict(false);
  };

  const handleSubmit = () => {
    const condition = buildCondition();
    if (condition) {
      if (conditionToEdit && onSaveCondition) {
        onSaveCondition(condition);
      } else {
        onAddCondition(condition);
      }
      handleClose();
    }
  };

  const buildCondition = (): ScheduleCondition | null => {
    const baseId = conditionToEdit?.id || `${type}_${Date.now()}`;
    const baseEnabled = conditionToEdit?.enabled ?? true;
    const base = { id: baseId, enabled: baseEnabled };

    switch (type) {
      case 'WorkloadLimit':
        if (scope === 'global') {
          return {
            ...base,
            type: 'WorkloadLimit',
            scope: 'global',
            minShiftsPerWeek: minShifts ? parseInt(minShifts, 10) : undefined,
            maxShiftsPerWeek: maxShifts ? parseInt(maxShifts, 10) : undefined,
            minHoursPerWeek: minHours ? parseInt(minHours, 10) : undefined,
            maxHoursPerWeek: maxHours ? parseInt(maxHours, 10) : undefined,
          } as any;
        } else {
          if (selectedUser.length === 0) return null;
          return {
            ...base,
            type: 'WorkloadLimit',
            scope: 'user',
            userId: selectedUser[0].uid,
            minShiftsPerWeek: minShifts ? parseInt(minShifts, 10) : undefined,
            maxShiftsPerWeek: maxShifts ? parseInt(maxShifts, 10) : undefined,
            minHoursPerWeek: minHours ? parseInt(minHours, 10) : undefined,
            maxHoursPerWeek: maxHours ? parseInt(maxHours, 10) : undefined,
          } as any;
        }
      case 'DailyShiftLimit':
        return {
          ...base,
          type: 'DailyShiftLimit',
          userId: selectedUser.length > 0 ? selectedUser[0].uid : undefined,
          maxPerDay: maxDaily ? parseInt(maxDaily, 10) : undefined,
        } as any;
      case 'ShiftStaffing':
        if (!selectedTemplate) return null;
        return {
          ...base,
          type: 'ShiftStaffing',
          templateId: selectedTemplate,
          role: staffingRole,
          count: parseInt(staffingCount, 10) || 1,
          mandatory: staffingMandatory,
        } as any;
      case 'StaffPriority':
        if (selectedUser.length === 0 || !selectedTemplate) return null;
        return {
          ...base,
          type: 'StaffPriority',
          userId: selectedUser[0].uid,
          templateId: selectedTemplate,
          weight: parseInt(priorityWeight, 10) || 1,
          mandatory: priorityMandatory,
        } as any;
      case 'StaffShiftLink':
        if (selectedUser.length === 0 || !selectedTemplate) return null;
        return {
          ...base,
          type: 'StaffShiftLink',
          userId: selectedUser[0].uid,
          templateId: selectedTemplate,
          link: linkType,
        } as any;
      case 'StaffExclusion':
        if (selectedUser.length === 0 || blockedUsers.length === 0) return null;
        return {
          ...base,
          type: 'StaffExclusion',
          userId: selectedUser[0].uid,
          blockedUserIds: blockedUsers.map(u => u.uid),
          templateId: selectedTemplate || undefined,
        } as any;
      case 'AvailabilityStrictness':
        return {
          ...base,
          type: 'AvailabilityStrictness',
          strict: availabilityStrict,
        } as any;
      default:
        return null;
    }
  };

  const canSubmit = (): boolean => {
    switch (type) {
      case 'WorkloadLimit':
        return scope === 'global' || selectedUser.length > 0;
      case 'DailyShiftLimit':
        return maxDaily !== '';
      case 'ShiftStaffing':
        return selectedTemplate !== '';
      case 'StaffPriority':
        return selectedUser.length > 0 && selectedTemplate !== '';
      case 'StaffShiftLink':
        return selectedUser.length > 0 && selectedTemplate !== '';
      case 'StaffExclusion':
        return selectedUser.length > 0 && blockedUsers.length > 0;
      case 'AvailabilityStrictness':
        return true;
      default:
        return false;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent side="right" className="w-full sm:w-[420px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Thêm điều kiện mới</SheetTitle>
          <SheetDescription>Chọn loại điều kiện và điền thông tin cần thiết.</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 mt-6">
          {/* Type Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Loại điều kiện</Label>
            <Select value={type} onValueChange={(v) => {
              setType(v as ConditionType);
              resetForm();
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WorkloadLimit">Định mức giờ/ca</SelectItem>
                <SelectItem value="DailyShiftLimit">Max Ca/Ngày</SelectItem>
                <SelectItem value="ShiftStaffing">Nhu cầu ca</SelectItem>
                <SelectItem value="StaffPriority">Ưu tiên nhân viên</SelectItem>
                <SelectItem value="StaffShiftLink">Ràng buộc nhân viên↔ca</SelectItem>
                <SelectItem value="StaffExclusion">Không ghép chung</SelectItem>
                <SelectItem value="AvailabilityStrictness">Thời gian rảnh</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Type-specific fields */}
          {type === 'WorkloadLimit' && (
            <WorkloadLimitForm
              scope={scope}
              setScope={setScope}
              selectedUser={selectedUser}
              setSelectedUser={setSelectedUser}
              allUsers={allUsers}
              minShifts={minShifts}
              setMinShifts={setMinShifts}
              maxShifts={maxShifts}
              setMaxShifts={setMaxShifts}
              minHours={minHours}
              setMinHours={setMinHours}
              maxHours={maxHours}
              setMaxHours={setMaxHours}
            />
          )}

          {type === 'DailyShiftLimit' && (
            <DailyLimitForm
              selectedUser={selectedUser}
              setSelectedUser={setSelectedUser}
              allUsers={allUsers}
              maxDaily={maxDaily}
              setMaxDaily={setMaxDaily}
            />
          )}

          {type === 'ShiftStaffing' && (
            <StaffingForm
              selectedTemplate={selectedTemplate}
              setSelectedTemplate={setSelectedTemplate}
              shiftTemplates={shiftTemplates}
              staffingRole={staffingRole}
              setStaffingRole={setStaffingRole}
              staffingCount={staffingCount}
              setStaffingCount={setStaffingCount}
              staffingMandatory={staffingMandatory}
              setStaffingMandatory={setStaffingMandatory}
            />
          )}

          {type === 'StaffPriority' && (
            <PriorityForm
              selectedUser={selectedUser}
              setSelectedUser={setSelectedUser}
              allUsers={allUsers}
              selectedTemplate={selectedTemplate}
              setSelectedTemplate={setSelectedTemplate}
              shiftTemplates={shiftTemplates}
              priorityWeight={priorityWeight}
              setPriorityWeight={setPriorityWeight}
              priorityMandatory={priorityMandatory}
              setPriorityMandatory={setPriorityMandatory}
            />
          )}

          {type === 'StaffShiftLink' && (
            <LinkForm
              selectedUser={selectedUser}
              setSelectedUser={setSelectedUser}
              allUsers={allUsers}
              selectedTemplate={selectedTemplate}
              setSelectedTemplate={setSelectedTemplate}
              shiftTemplates={shiftTemplates}
              linkType={linkType}
              setLinkType={setLinkType}
            />
          )}

          {type === 'StaffExclusion' && (
            <ExclusionForm
              selectedUser={selectedUser}
              setSelectedUser={setSelectedUser}
              blockedUsers={blockedUsers}
              setBlockedUsers={setBlockedUsers}
              allUsers={allUsers}
              selectedTemplate={selectedTemplate}
              setSelectedTemplate={setSelectedTemplate}
              shiftTemplates={shiftTemplates}
            />
          )}

          {type === 'AvailabilityStrictness' && (
            <AvailabilityForm
              availabilityStrict={availabilityStrict}
              setAvailabilityStrict={setAvailabilityStrict}
            />
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Hủy
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit()} className="flex-1">
              Thêm điều kiện
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function WorkloadLimitForm({ scope, setScope, selectedUser, setSelectedUser, allUsers, minShifts, setMinShifts, maxShifts, setMaxShifts, minHours, setMinHours, maxHours, setMaxHours }: {
  scope: 'global' | 'user';
  setScope: React.Dispatch<React.SetStateAction<'global' | 'user'>>;
  selectedUser: ManagedUser[];
  setSelectedUser: React.Dispatch<React.SetStateAction<ManagedUser[]>>;
  allUsers: ManagedUser[];
  minShifts: string;
  setMinShifts: React.Dispatch<React.SetStateAction<string>>;
  maxShifts: string;
  setMaxShifts: React.Dispatch<React.SetStateAction<string>>;
  minHours: string;
  setMinHours: React.Dispatch<React.SetStateAction<string>>;
  maxHours: string;
  setMaxHours: React.Dispatch<React.SetStateAction<string>>;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-xs font-semibold">Phạm vi</Label>
        <Select value={scope} onValueChange={(v) => setScope(v as 'global' | 'user')}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="global">Toàn cục</SelectItem>
            <SelectItem value="user">Từng nhân viên</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {scope === 'user' && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Chọn nhân viên</Label>
          <UserMultiSelect
            selectionMode="single"
            users={allUsers}
            selectedUsers={selectedUser}
            onChange={setSelectedUser}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Min Ca</Label>
          <Input
            type="number"
            min={0}
            placeholder="0"
            value={minShifts}
            onChange={(e) => setMinShifts(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Max Ca</Label>
          <Input
            type="number"
            min={0}
            placeholder="0"
            value={maxShifts}
            onChange={(e) => setMaxShifts(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Min Giờ</Label>
          <Input
            type="number"
            min={0}
            placeholder="0"
            value={minHours}
            onChange={(e) => setMinHours(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Max Giờ</Label>
          <Input
            type="number"
            min={0}
            placeholder="0"
            value={maxHours}
            onChange={(e) => setMaxHours(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      </div>
    </div>
  );
}

function DailyLimitForm({ selectedUser, setSelectedUser, allUsers, maxDaily, setMaxDaily }: {
  selectedUser: ManagedUser[];
  setSelectedUser: React.Dispatch<React.SetStateAction<ManagedUser[]>>;
  allUsers: ManagedUser[];
  maxDaily: string;
  setMaxDaily: React.Dispatch<React.SetStateAction<string>>;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-xs font-semibold">Chọn nhân viên (tùy chọn - để trống cho toàn cục)</Label>
        <UserMultiSelect
          selectionMode="single"
          users={allUsers}
          selectedUsers={selectedUser}
          onChange={setSelectedUser}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs font-semibold">Max Ca/Ngày</Label>
        <Input
          type="number"
          min={1}
          placeholder="1"
          value={maxDaily}
          onChange={(e) => setMaxDaily(e.target.value)}
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
}

function StaffingForm({ selectedTemplate, setSelectedTemplate, shiftTemplates, staffingRole, setStaffingRole, staffingCount, setStaffingCount, staffingMandatory, setStaffingMandatory }: {
  selectedTemplate: string;
  setSelectedTemplate: React.Dispatch<React.SetStateAction<string>>;
  shiftTemplates: ShiftTemplate[];
  staffingRole: UserRole | 'Bất kỳ';
  setStaffingRole: React.Dispatch<React.SetStateAction<UserRole | 'Bất kỳ'>>;
  staffingCount: string;
  setStaffingCount: React.Dispatch<React.SetStateAction<string>>;
  staffingMandatory: boolean;
  setStaffingMandatory: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-xs font-semibold">Chọn ca</Label>
        <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
          <SelectTrigger className="h-8">
            <SelectValue placeholder="Chọn ca" />
          </SelectTrigger>
          <SelectContent>
            {shiftTemplates.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.label} ({t.timeSlot.start}-{t.timeSlot.end})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Vai trò</Label>
          <Select value={staffingRole} onValueChange={(v) => setStaffingRole(v as UserRole | 'Bất kỳ')}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Bất kỳ">Bất kỳ</SelectItem>
              <SelectItem value="Phục vụ">Phục vụ</SelectItem>
              <SelectItem value="Pha chế">Pha chế</SelectItem>
              <SelectItem value="Thu ngân">Thu ngân</SelectItem>
              <SelectItem value="Quản lý">Quản lý</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Số lượng</Label>
          <Input
            type="number"
            min={1}
            placeholder="1"
            value={staffingCount}
            onChange={(e) => setStaffingCount(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="staffing-mandatory"
          checked={staffingMandatory}
          onCheckedChange={(v) => setStaffingMandatory(v as boolean)}
          className="h-3 w-3"
        />
        <label htmlFor="staffing-mandatory" className="text-xs font-medium">Bắt buộc</label>
      </div>
    </div>
  );
}

function PriorityForm({ selectedUser, setSelectedUser, allUsers, selectedTemplate, setSelectedTemplate, shiftTemplates, priorityWeight, setPriorityWeight, priorityMandatory, setPriorityMandatory }: {
  selectedUser: ManagedUser[];
  setSelectedUser: React.Dispatch<React.SetStateAction<ManagedUser[]>>;
  allUsers: ManagedUser[];
  selectedTemplate: string;
  setSelectedTemplate: React.Dispatch<React.SetStateAction<string>>;
  shiftTemplates: ShiftTemplate[];
  priorityWeight: string;
  setPriorityWeight: React.Dispatch<React.SetStateAction<string>>;
  priorityMandatory: boolean;
  setPriorityMandatory: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-xs font-semibold">Chọn nhân viên</Label>
        <UserMultiSelect
          selectionMode="single"
          users={allUsers}
          selectedUsers={selectedUser}
          onChange={setSelectedUser}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold">Chọn ca</Label>
        <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
          <SelectTrigger className="h-8">
            <SelectValue placeholder="Chọn ca" />
          </SelectTrigger>
          <SelectContent>
            {shiftTemplates.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.label} ({t.timeSlot.start}-{t.timeSlot.end})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold">Trọng số (0-5)</Label>
        <Select value={priorityWeight} onValueChange={setPriorityWeight}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[0, 1, 2, 3, 4, 5].map(n => (
              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="priority-mandatory"
          checked={priorityMandatory}
          onCheckedChange={(v) => setPriorityMandatory(v as boolean)}
          className="h-3 w-3"
        />
        <label htmlFor="priority-mandatory" className="text-xs font-medium">Bắt buộc</label>
      </div>
    </div>
  );
}

function LinkForm({ selectedUser, setSelectedUser, allUsers, selectedTemplate, setSelectedTemplate, shiftTemplates, linkType, setLinkType }: {
  selectedUser: ManagedUser[];
  setSelectedUser: React.Dispatch<React.SetStateAction<ManagedUser[]>>;
  allUsers: ManagedUser[];
  selectedTemplate: string;
  setSelectedTemplate: React.Dispatch<React.SetStateAction<string>>;
  shiftTemplates: ShiftTemplate[];
  linkType: 'force' | 'ban';
  setLinkType: React.Dispatch<React.SetStateAction<'force' | 'ban'>>;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-xs font-semibold">Chọn nhân viên</Label>
        <UserMultiSelect
          selectionMode="single"
          users={allUsers}
          selectedUsers={selectedUser}
          onChange={setSelectedUser}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold">Chọn ca</Label>
        <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
          <SelectTrigger className="h-8">
            <SelectValue placeholder="Chọn ca" />
          </SelectTrigger>
          <SelectContent>
            {shiftTemplates.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.label} ({t.timeSlot.start}-{t.timeSlot.end})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold">Loại ràng buộc</Label>
        <Select value={linkType} onValueChange={(v) => setLinkType(v as 'force' | 'ban')}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="force">Bắt buộc (nhân viên phải có ca này)</SelectItem>
            <SelectItem value="ban">Cấm (nhân viên không được có ca này)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function ExclusionForm({
  selectedUser,
  setSelectedUser,
  blockedUsers,
  setBlockedUsers,
  allUsers,
  selectedTemplate,
  setSelectedTemplate,
  shiftTemplates,
}: {
  selectedUser: ManagedUser[];
  setSelectedUser: React.Dispatch<React.SetStateAction<ManagedUser[]>>;
  blockedUsers: ManagedUser[];
  setBlockedUsers: React.Dispatch<React.SetStateAction<ManagedUser[]>>;
  allUsers: ManagedUser[];
  selectedTemplate: string;
  setSelectedTemplate: React.Dispatch<React.SetStateAction<string>>;
  shiftTemplates: ShiftTemplate[];
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-xs font-semibold">Nhân viên chính</Label>
        <UserMultiSelect
          selectionMode="single"
          users={allUsers}
          selectedUsers={selectedUser}
          onChange={setSelectedUser}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold">Cấm làm chung với</Label>
        <UserMultiSelect
          selectionMode="multiple"
          users={allUsers.filter(u => selectedUser.length === 0 || u.uid !== selectedUser[0].uid)}
          selectedUsers={blockedUsers}
          onChange={setBlockedUsers}
        />
        <p className="text-[11px] text-muted-foreground">Những người này sẽ không được xếp chung ca với nhân viên trên.</p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold">Áp dụng cho ca (tùy chọn)</Label>
        <Select
          value={selectedTemplate || 'ALL'}
          onValueChange={(val) => setSelectedTemplate(val === 'ALL' ? '' : val)}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="Tất cả ca" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả ca</SelectItem>
            {shiftTemplates.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.label} ({t.timeSlot.start}-{t.timeSlot.end})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function AvailabilityForm({ availabilityStrict, setAvailabilityStrict }: {
  availabilityStrict: boolean;
  setAvailabilityStrict: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  return (
    <Card className="bg-muted/30">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start gap-3">
          <Checkbox
            id="availability-strict"
            checked={availabilityStrict}
            onCheckedChange={(v) => setAvailabilityStrict(v as boolean)}
            className="h-4 w-4 mt-1"
          />
          <div className="space-y-1 flex-1">
            <label htmlFor="availability-strict" className="text-xs font-semibold">Buộc tuân thủ thời gian rảnh</label>
            <p className="text-[11px] text-muted-foreground">Nếu bật, phân công bắt buộc sẽ bị bỏ qua nếu nhân viên không rảnh, thay vì chỉ cảnh báo.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
