import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

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

export interface Client {
  id: string;
  name: string;
  status: 'pending' | 'partial' | 'paid' | 'no_service';
  paymentType: 'partial' | 'discount' | null;
  quotedFees: number | null;
  otherDues: number | null;
  feesReceived: number | null;
  itrFiled: boolean;
  comments: string | null;
  history: HistoryEntry[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export function useFinancialYears(uid: string | undefined) {
  const [years, setYears] = useState<FinancialYear[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setYears([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, `users/${uid}/financial_years`),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const yearsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as FinancialYear[];
      setYears(yearsData);
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
    if (!uid || !fyId) {
      setClients([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, `users/${uid}/financial_years/${fyId}/clients`),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clientsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Client[];
      setClients(clientsData);
      setLoading(false);
    });

    return unsubscribe;
  }, [uid, fyId]);

  return { clients, loading };
}

export async function createFinancialYear(uid: string, name: string) {
  const docRef = await addDoc(collection(db, `users/${uid}/financial_years`), {
    name,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function createClient(uid: string, fyId: string, name: string) {
  const docRef = await addDoc(
    collection(db, `users/${uid}/financial_years/${fyId}/clients`),
    {
      name,
      status: 'pending',
      paymentType: null,
      quotedFees: null,
      otherDues: null,
      feesReceived: null,
      itrFiled: false,
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
  const clientRef = doc(
    db,
    `users/${uid}/financial_years/${fyId}/clients/${clientId}`
  );
  await updateDoc(clientRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteClient(
  uid: string,
  fyId: string,
  clientId: string
) {
  const clientRef = doc(
    db,
    `users/${uid}/financial_years/${fyId}/clients/${clientId}`
  );
  await deleteDoc(clientRef);
}
