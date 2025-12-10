'use client';

import { db, storage } from './firebase';
import {
  collection,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  getDocs,
  addDoc,
  writeBatch,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { photoStore } from './photo-store';
import isEqual from 'lodash.isequal';
import { parseISO, isWithinInterval, startOfMonth, endOfMonth, differenceInMinutes } from 'date-fns';
import type { Violation, ViolationCategoryData, ViolationUserCost } from './types';

const severityOrder: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export async function getViolationCategories(): Promise<ViolationCategoryData> {
  const docRef = doc(db, 'app-data', 'violationCategories');
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      list: (data.list || []) as any,
      generalRules: (data.generalRules || []) as any,
    } as ViolationCategoryData;
  }
  return { list: [] as any, generalRules: [] as any } as ViolationCategoryData;
}

export function calculateViolationCost(
  violation: Violation,
  categoryData: ViolationCategoryData,
  allHistoricViolationsInMonth: Violation[]
): { cost: number; severity: Violation['severity']; userCosts: ViolationUserCost[] } {
  const category = categoryData.list.find(c => c.id === violation.categoryId);
  if (!category) {
    return { cost: violation.cost || 0, severity: violation.severity || 'low', userCosts: violation.userCosts || [] };
  }

  const baseCost = category.calculationType === 'perUnit'
    ? (category.finePerUnit || 0) * (violation.unitCount || 0)
    : (category.fineAmount || 0);

  let totalCost = 0;
  const userCosts: ViolationUserCost[] = [];

  violation.users.forEach(user => {
    let userFine = baseCost;
    let userSeverity = category.severity;

    const violationCreatedAt = violation.createdAt ? parseISO(violation.createdAt as string) : new Date(0);
    if (violationCreatedAt.getTime() === 0) {
      userCosts.push({ userId: user.id, cost: userFine, severity: userSeverity });
      totalCost += userFine;
      return;
    };

    const sortedRules = (categoryData.generalRules || []).sort((a, b) => (a.threshold || 0) - (b.threshold || 0));

    for (const rule of sortedRules) {
      let ruleApplies = false;
      if (rule.condition === 'is_flagged' && violation.isFlagged) {
        ruleApplies = true;
      } else if (rule.condition === 'repeat_in_month') {
        const repeatCount = allHistoricViolationsInMonth.filter(v =>
          v.id !== violation.id &&
          v.users.some(vu => vu.id === user.id) &&
          v.categoryId === violation.categoryId &&
          isWithinInterval(parseISO(v.createdAt as string), { start: startOfMonth(violationCreatedAt), end: endOfMonth(violationCreatedAt) }) &&
          new Date(v.createdAt as string) < violationCreatedAt
        ).length + 1;

        if (repeatCount >= rule.threshold) {
          ruleApplies = true;
        }
      }

      if (ruleApplies) {
        if (rule.action === 'multiply') {
          userFine *= rule.value;
        } else if (rule.action === 'add') {
          userFine += rule.value;
        }

        if (rule.severityAction === 'increase') {
          if (userSeverity === 'low') userSeverity = 'medium';
          else if (userSeverity === 'medium') userSeverity = 'high';
        } else if (rule.severityAction === 'set_to_high') {
          userSeverity = 'high';
        }
      }
    }

    userCosts.push({ userId: user.id, cost: userFine, severity: userSeverity });
    totalCost += userFine;
  });

  const finalSeverity = userCosts.reduce((maxSeverity, userCost) => {
    return severityOrder[userCost.severity] > severityOrder[maxSeverity] ? userCost.severity : maxSeverity;
  }, category.severity);

  return { cost: totalCost, severity: finalSeverity, userCosts };
}

export async function addOrUpdateViolation(
  data: Omit<Violation, 'id' | 'createdAt' | 'photos' | 'penaltySubmissions' | 'cost' | 'severity'> & { photosToUpload: string[] },
  id?: string
): Promise<void> {
  const { photosToUpload, ...violationData } = data as any;

  const uploadPromises = photosToUpload.map(async (photoId: string) => {
    const photoBlob = await photoStore.getPhoto(photoId);
    if (!photoBlob) return null;
    const storageRef = ref(storage, `violations/${data.reporterId}/${uuidv4()}.jpg`);
    const metadata = {
      cacheControl: 'public,max-age=31536000,immutable',
    };
    await uploadBytes(storageRef, photoBlob, metadata);
    return getDownloadURL(storageRef);
  });
  const photoUrls = (await Promise.all(uploadPromises)).filter((url): url is string => !!url);

  const finalData: Partial<Violation> = { ...violationData };

  if (id) {
    const docRef = doc(db, 'violations', id);
    const currentDoc = await getDoc(docRef);
    if (currentDoc.exists()) {
      const existingPhotos = currentDoc.data().photos || [];
      finalData.photos = [...existingPhotos, ...photoUrls];
      finalData.lastModified = serverTimestamp() as Timestamp;
      await updateDoc(docRef, finalData);
    }
  } else {
    finalData.createdAt = serverTimestamp() as Timestamp;
    finalData.photos = photoUrls;
    await addDoc(collection(db, 'violations'), finalData);
  }

  await photoStore.deletePhotos(photosToUpload);
  await recalculateViolationsForCurrentMonth();
}

export async function recalculateViolationsForCurrentMonth(): Promise<void> {
  const categoryData = await getViolationCategories();

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const violationsQuery = query(
    collection(db, 'violations'),
    where('createdAt', '>=', monthStart),
    where('createdAt', '<=', monthEnd)
  );

  const violationsSnapshot = await getDocs(violationsQuery);
  if (violationsSnapshot.empty) return;

  const allViolationsInMonth = violationsSnapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: (data.createdAt as Timestamp)?.toDate()?.toISOString() || new Date(0).toISOString(),
    } as Violation;
  }).sort((a, b) => new Date(a.createdAt as string).getTime() - new Date(b.createdAt as string).getTime());

  const batch = writeBatch(db);
  let hasUpdates = false;

  allViolationsInMonth.forEach(violation => {
    const { cost: newCost, severity: newSeverity, userCosts: newUserCosts } = calculateViolationCost(violation, categoryData, allViolationsInMonth);
    const hasChanged = violation.cost !== newCost || violation.severity !== newSeverity || !isEqual(violation.userCosts, newUserCosts);

    if (hasChanged) {
      const docRef = doc(db, 'violations', violation.id);
      batch.update(docRef, { cost: newCost, severity: newSeverity, userCosts: newUserCosts });
      hasUpdates = true;
    }
  });

  if (hasUpdates) {
    try {
      await batch.commit();
    } catch (err) {
      console.error("Error recalculating and batch updating violation costs:", err);
    }
  }
}
