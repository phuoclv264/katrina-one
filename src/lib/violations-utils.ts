
import type { Violation, ManagedUser } from '@/lib/types';

export const getSeverityBadgeClass = (severity: Violation['severity']) => {
    switch (severity) {
      case 'high': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-none shadow-sm font-bold';
      case 'medium': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-none shadow-sm font-bold';
      case 'low':
      default:
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-none shadow-sm font-bold';
    }
};

export const getSeverityCardClass = (severity: Violation['severity']) => {
    switch (severity) {
    case 'high': return 'bg-rose-50/60 dark:bg-rose-950/20';
    case 'medium': return 'bg-amber-50/40 dark:bg-amber-950/10';
    case 'low': return 'bg-white dark:bg-blue-950/10';
    default: return 'bg-white dark:bg-zinc-950';
    }
};

export const getSeverityBorderClass = (severity: Violation['severity']) => {
    switch (severity) {
    case 'high': return 'border-rose-100 dark:border-rose-900/50';
    case 'medium': return 'border-amber-100 dark:border-amber-900/50';
    case 'low': return 'border-blue-100/50 dark:border-blue-900/50';
    default: return 'border-zinc-100 dark:border-zinc-900';
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
