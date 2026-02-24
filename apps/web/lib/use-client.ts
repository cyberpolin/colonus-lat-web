"use client";

import { useState } from "react";
import { createId, createScopedStorageKey, type Landlord, type Tenant } from "@colonus/shared";
import { useColonusStore } from "@/lib/store";

const CLIENT_DRAFT_STORAGE_KEY = createScopedStorageKey("COLONUS_CLIENT_DRAFT");

export interface TemporalLandlord {
  fullName: string;
  email: string;
  phone?: string;
  paymentSubmissionFrequency: Landlord["paymentSubmissionFrequency"];
  proofSubmissionFrequency: Landlord["proofSubmissionFrequency"];
}

export interface TemporalProperty {
  tempId: string;
  name: string;
  address: string;
  unitCode?: string;
  monthlyRentCents: number;
}

export interface TemporalTennat {
  tempId: string;
  fullName: string;
  email: string;
  phone?: string;
  propertyTempId: string;
  rentCycleMonths: Tenant["rentCycleMonths"];
  rentAmountCents: number;
}

export interface CreatedClientResult {
  landlordId: string;
  propertyIds: string[];
  tenantIds: string[];
}

interface ClientDraftState {
  temporalLandlord?: TemporalLandlord;
  temporalProperties: TemporalProperty[];
  temporalTennats: TemporalTennat[];
}

const readDraftFromStorage = (): ClientDraftState => {
  if (typeof window === "undefined") {
    return { temporalLandlord: undefined, temporalProperties: [], temporalTennats: [] };
  }
  try {
    const raw = window.localStorage.getItem(CLIENT_DRAFT_STORAGE_KEY);
    if (!raw) return { temporalLandlord: undefined, temporalProperties: [], temporalTennats: [] };
    const parsed = JSON.parse(raw) as Partial<ClientDraftState>;
    return {
      temporalLandlord: parsed.temporalLandlord,
      temporalProperties: parsed.temporalProperties ?? [],
      temporalTennats: parsed.temporalTennats ?? []
    };
  } catch {
    return { temporalLandlord: undefined, temporalProperties: [], temporalTennats: [] };
  }
};

const writeDraftToStorage = (input: ClientDraftState): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CLIENT_DRAFT_STORAGE_KEY, JSON.stringify(input));
};

export const hasClientDraftInStorage = (): boolean => {
  const draft = readDraftFromStorage();
  return Boolean(
    draft.temporalLandlord || draft.temporalProperties.length > 0 || draft.temporalTennats.length > 0
  );
};

export function useClient() {
  const addLandlord = useColonusStore((state) => state.addLandlord);
  const addProperty = useColonusStore((state) => state.addProperty);
  const addTenant = useColonusStore((state) => state.addTenant);
  const markLandlordCredentialsSent = useColonusStore((state) => state.markLandlordCredentialsSent);

  const initialDraft = readDraftFromStorage();
  const [temporalLandlord, setTemporalLandlord] = useState<TemporalLandlord | undefined>(
    initialDraft.temporalLandlord
  );
  const [temporalProperties, setTemporalProperties] = useState<TemporalProperty[]>(
    initialDraft.temporalProperties
  );
  const [temporalTennats, setTemporalTennats] = useState<TemporalTennat[]>(initialDraft.temporalTennats);

  const persistDraft = (next: ClientDraftState): void => {
    writeDraftToStorage(next);
  };

  const createTemporalLandlord = (input: TemporalLandlord) => {
    setTemporalLandlord(input);
    persistDraft({
      temporalLandlord: input,
      temporalProperties,
      temporalTennats
    });
  };

  const createTemporalProperty = (input: Omit<TemporalProperty, "tempId">) => {
    const record: TemporalProperty = { ...input, tempId: createId("temp_property") };
    const nextProperties = [...temporalProperties, record];
    setTemporalProperties(nextProperties);
    persistDraft({
      temporalLandlord,
      temporalProperties: nextProperties,
      temporalTennats
    });
    return record;
  };

  const createTemporalTennat = (input: Omit<TemporalTennat, "tempId">) => {
    const record: TemporalTennat = { ...input, tempId: createId("temp_tennat") };
    const nextTennats = [...temporalTennats, record];
    setTemporalTennats(nextTennats);
    persistDraft({
      temporalLandlord,
      temporalProperties,
      temporalTennats: nextTennats
    });
    return record;
  };

  const removeTemporalProperty = (tempId: string) => {
    const nextProperties = temporalProperties.filter((item) => item.tempId !== tempId);
    const nextTennats = temporalTennats.filter((item) => item.propertyTempId !== tempId);
    setTemporalProperties(nextProperties);
    setTemporalTennats(nextTennats);
    persistDraft({
      temporalLandlord,
      temporalProperties: nextProperties,
      temporalTennats: nextTennats
    });
  };

  const removeTemporalTennat = (tempId: string) => {
    const nextTennats = temporalTennats.filter((item) => item.tempId !== tempId);
    setTemporalTennats(nextTennats);
    persistDraft({
      temporalLandlord,
      temporalProperties,
      temporalTennats: nextTennats
    });
  };

  const resetTemporalClient = () => {
    setTemporalLandlord(undefined);
    setTemporalProperties([]);
    setTemporalTennats([]);
    persistDraft({ temporalLandlord: undefined, temporalProperties: [], temporalTennats: [] });
  };

  const createClient = async (input?: { sendCredentials?: boolean }): Promise<CreatedClientResult> => {
    if (!temporalLandlord) {
      throw new Error("Landlord draft is required before creating a client.");
    }

    const landlord = await addLandlord(temporalLandlord);
    const propertyIdByTempId = new Map<string, string>();

    temporalProperties.forEach((property) => {
      const persisted = addProperty({
        landlordId: landlord.id,
        name: property.name,
        address: property.address,
        unitCode: property.unitCode,
        monthlyRentCents: property.monthlyRentCents
      });
      propertyIdByTempId.set(property.tempId, persisted.id);
    });

    const tenantIds: string[] = [];
    for (const tennat of temporalTennats) {
      const propertyId = propertyIdByTempId.get(tennat.propertyTempId);
      if (!propertyId) continue;
      const persisted = await addTenant({
        fullName: tennat.fullName,
        email: tennat.email,
        phone: tennat.phone,
        landlordId: landlord.id,
        propertyId,
        rentCycleMonths: tennat.rentCycleMonths,
        rentAmountCents: tennat.rentAmountCents
      });
      tenantIds.push(persisted.id);
    }

    if (input?.sendCredentials ?? true) {
      markLandlordCredentialsSent(landlord.id);
    }

    const result: CreatedClientResult = {
      landlordId: landlord.id,
      propertyIds: Array.from(propertyIdByTempId.values()),
      tenantIds
    };

    resetTemporalClient();
    return result;
  };

  return {
    temporalLandlord,
    temporalProperties,
    temporalTennats,
    hasDraft: Boolean(temporalLandlord || temporalProperties.length > 0 || temporalTennats.length > 0),
    createTemporalLandlord,
    createTemporalProperty,
    createTemporalTennat,
    removeTemporalProperty,
    removeTemporalTennat,
    resetTemporalClient,
    createClient
  };
}
