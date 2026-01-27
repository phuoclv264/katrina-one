
import type { Violation, ManagedUser } from '@/lib/types';

export const getSeverityBadgeClass = (severity: Violation['severity']) => {
    switch (severity) {
      case 'high': return 'bg-rose-100 text-rose-700 border-none shadow-sm font-black';
      case 'medium': return 'bg-amber-100 text-amber-700 border-none shadow-sm font-black';
      case 'low':
      default:
        return 'bg-blue-100 text-blue-700 border-none shadow-sm font-black';
    }
};

export const getSeverityCardClass = (severity: Violation['severity']) => {
    switch (severity) {
    case 'high': return 'bg-rose-500/5';
    case 'medium': return 'bg-amber-500/5';
    default: return 'bg-white';
    }
};

export const getSeverityBorderClass = (severity: Violation['severity']) => {
    switch (severity) {
    case 'high': return 'border-rose-500/30';
    case 'medium': return 'border-amber-500/30';
    default: return 'border-zinc-100';
    }
};

export const generateSmartAbbreviations = (users: ManagedUser[]): Map<string, string> => {
    const abbreviations = new Map<string, string>();
    const usersByLastName = new Map<string, ManagedUser[]>();

    // Group users by their last name (first name in Vietnamese context)
    users.forEach(user => {
        const nameParts = user.displayName.trim().split(/\s+/);
        if (nameParts.length > 0) {
            const lastName = nameParts[nameParts.length - 1];
            if (!usersByLastName.has(lastName)) {
                usersByLastName.set(lastName, []);
            }
            usersByLastName.get(lastName)!.push(user);
        }
    });

    for (const [lastName, userGroup] of usersByLastName.entries()) {
        if (userGroup.length === 1 && ![...usersByLastName.keys()].some(key => key !== lastName && key.includes(lastName))) {
            // If the last name is unique across all users, just use the last name
            abbreviations.set(userGroup[0].uid, lastName);
        } else {
            // If last names are duplicated, generate abbreviations
            userGroup.forEach(user => {
                const nameParts = user.displayName.trim().split(/\s+/);
                // Start with just the last name
                let currentAbbr = lastName;
                // Iterate backwards from the second to last part of the name
                for (let i = nameParts.length - 2; i >= 0; i--) {
                    const candidateAbbr = `${nameParts[i].charAt(0).toUpperCase()}.${currentAbbr}`;
                    
                    // Check if this new abbreviation already exists for another user in the group
                    const isDuplicate = userGroup.some(otherUser => {
                         if (otherUser.uid === user.uid) return false; // Don't compare with self
                         const otherParts = otherUser.displayName.trim().split(/\s+/);
                         let otherAbbr = otherParts[otherParts.length - 1];
                         for(let j = otherParts.length - 2; j >= i; j--) {
                            otherAbbr = `${otherParts[j].charAt(0).toUpperCase()}.${otherAbbr}`;
                         }
                         return otherAbbr === candidateAbbr;
                    });
                    
                    currentAbbr = candidateAbbr;
                    if (!isDuplicate) {
                        break; // This abbreviation is unique within the group, we can stop
                    }
                }
                 abbreviations.set(user.uid, currentAbbr);
            });
        }
    }

    return abbreviations;
};
