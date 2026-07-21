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
  const [settings, setSettings] = useState<UserSettings>({ customTags: [] });

  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, `users/${uid}/settings/app`);
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) setSettings(snap.data() as UserSettings);
      else setSettings({ customTags: [] });
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
