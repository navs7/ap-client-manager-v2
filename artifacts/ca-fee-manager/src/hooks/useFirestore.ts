import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const DEFAULT_TAGS = ['Salaried', 'Capital Gain', 'Business Owner', 'Foreign Assets'];

export const DEFAULT_WA_MESSAGES = [
  `Dear {name}, this is a gentle reminder regarding your pending CA fees of {amount} for FY {fy}. Kindly arrange payment at your earliest convenience. Thank you.`,
  `Hi {name}, hope you're doing well. This is a friendly reminder about your outstanding CA fees of {amount} for FY {fy}. Please feel free to reach out if you have any queries. Thank you.`,
  `Dear {name}, your CA fees of {amount} for FY {fy} are pending. Request you to kindly clear the dues at your earliest. For any queries, feel free to contact us.`,
  `Hi {name}, a gentle reminder that CA fees of {amount} are due for FY {fy}. Kindly arrange payment at your earliest convenience. Thank you for your trust.`,
  `Dear {name}, this is to inform you that CA service fees of {amount} for FY {fy} are outstanding. Kindly arrange to settle the same. Thank you for your continued support.`,
];

export interface FinancialYear {
  id: string;
  name: string;
  createdAt: Timestamp;
}

export interface HistoryEntry {
  id: string;
  action: string;
  at: string; // ISO 8601 client-side timestamp
}

export interface UserSettings {
  customTags: string[];
  waMessages: string[];   // user-saved custom WA message templates
  waTemplate: string | null; // currently active template (null = first built-in)
}

export interface Client {
  id: string;
  name: string;
  mobile: string | null;
  status: 'pending' | 'partial' | 'paid' | 'no_service';
  paymentType: 'partial' | 'discount' | null;
  quotedFees: number | null;
  otherDues: number | null;
  feesReceived: number | null;
  itrFiled: boolean;
  tags: string[];
  comments: string | null;
  history: HistoryEntry[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export function useFinancialYears(uid: string | undefined) {
  const [years, setYears] = useState<FinancialYear[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setYears([]); setLoading(false); return; }
    const q = query(collection(db, `users/${uid}/financial_years`), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setYears(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as FinancialYear[]);
      setLoading(false);
    });
    return unsubscribe;
  }, [uid]);

  return { years, loading };
}

export function useClients(uid: string | undefined, fyId: string | undefined) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !fyId) { setClients([]); setLoading(false); return; }
    const q = query(
      collection(db, `users/${uid}/financial_years/${fyId}/clients`),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClients(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Client[]);
      setLoading(false);
    });
    return unsubscribe;
  }, [uid, fyId]);

  return { clients, loading };
}

export function useUserSettings(uid: string | undefined) {
  const [settings, setSettings] = useState<UserSettings>({ customTags: [], waMessages: [], waTemplate: null });

  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, `users/${uid}/settings/app`);
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSettings({
          customTags: data.customTags ?? [],
          waMessages: data.waMessages ?? [],
          waTemplate: data.waTemplate ?? null,
        });
      } else setSettings({ customTags: [], waMessages: [], waTemplate: null });
    });
  }, [uid]);

  return settings;
}

export async function updateUserSettings(uid: string, data: Partial<UserSettings>) {
  const ref = doc(db, `users/${uid}/settings/app`);
  await setDoc(ref, data, { merge: true });
}

export async function createFinancialYear(uid: string, name: string) {
  const docRef = await addDoc(collection(db, `users/${uid}/financial_years`), {
    name,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function createClient(uid: string, fyId: string, name: string, mobile: string | null = null) {
  const docRef = await addDoc(
    collection(db, `users/${uid}/financial_years/${fyId}/clients`),
    {
      name,
      mobile,
      status: 'pending',
      paymentType: null,
      quotedFees: null,
      otherDues: null,
      feesReceived: null,
      itrFiled: false,
      tags: [],
      comments: null,
      history: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
  );
  return docRef.id;
}

export async function updateClient(
  uid: string,
  fyId: string,
  clientId: string,
  data: Partial<Omit<Client, 'id' | 'createdAt'>>
) {
  const clientRef = doc(db, `users/${uid}/financial_years/${fyId}/clients/${clientId}`);
  await updateDoc(clientRef, { ...data, updatedAt: serverTimestamp() });
}

export async function deleteClient(uid: string, fyId: string, clientId: string) {
  await deleteDoc(doc(db, `users/${uid}/financial_years/${fyId}/clients/${clientId}`));
}
