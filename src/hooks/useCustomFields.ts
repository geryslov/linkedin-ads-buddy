import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CustomField {
  id: string;
  account_id: string;
  entity_type: 'campaign' | 'campaign_group';
  entity_id: string;
  field_name: string;
  field_value: string | null;
  created_at: string;
  updated_at: string;
}

export interface GroupedCustomFields {
  [key: string]: Record<string, string>;
}

export function useCustomFields(accessToken: string | null) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [grouped, setGrouped] = useState<GroupedCustomFields>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomFields = useCallback(async (
    accountId: string,
    entityType?: 'campaign' | 'campaign_group',
    entityId?: string
  ) => {
    if (!accessToken || !accountId) {
      console.error('[useCustomFields] fetchCustomFields: missing required parameters', {
        hasAccessToken: !!accessToken,
        hasAccountId: !!accountId
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_custom_fields',
          accessToken,
          params: { accountId, entityType, entityId }
        }
      });

      if (fnError) {
        setError(fnError.message || 'Failed to fetch custom fields');
        return;
      }

      if (result?.error) {
        setError(result.error);
        return;
      }

      setFields(result.fields || []);
      setGrouped(result.grouped || {});
    } catch (err) {
      setError('Failed to fetch custom fields');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  const setCustomField = useCallback(async (
    accountId: string,
    entityType: 'campaign' | 'campaign_group',
    entityId: string,
    fieldName: string,
    fieldValue: string | null
  ): Promise<boolean> => {
    if (!accessToken || !accountId) {
      console.error('[useCustomFields] setCustomField: missing required parameters', {
        hasAccessToken: !!accessToken,
        hasAccountId: !!accountId,
        entityType,
        entityId,
        fieldName
      });
      return false;
    }

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'set_custom_field',
          accessToken,
          params: { accountId, entityType, entityId, fieldName, fieldValue }
        }
      });

      if (fnError || result?.error) {
        console.error('Failed to set custom field:', fnError || result?.error);
        return false;
      }

      // Update local state
      if (result?.field) {
        setFields(prev => {
          const existing = prev.findIndex(f =>
            f.entity_type === entityType &&
            f.entity_id === entityId &&
            f.field_name === fieldName
          );
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = result.field;
            return updated;
          }
          return [...prev, result.field];
        });

        setGrouped(prev => {
          const key = `${entityType}:${entityId}`;
          return {
            ...prev,
            [key]: {
              ...(prev[key] || {}),
              [fieldName]: fieldValue || ''
            }
          };
        });
      }

      return true;
    } catch (err) {
      console.error('Failed to set custom field:', err);
      return false;
    }
  }, [accessToken]);

  const deleteCustomField = useCallback(async (
    accountId: string,
    entityType: 'campaign' | 'campaign_group',
    entityId: string,
    fieldName: string
  ): Promise<boolean> => {
    if (!accessToken || !accountId) {
      console.error('[useCustomFields] deleteCustomField: missing required parameters', {
        hasAccessToken: !!accessToken,
        hasAccountId: !!accountId,
        entityType,
        entityId,
        fieldName
      });
      return false;
    }

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'delete_custom_field',
          accessToken,
          params: { accountId, entityType, entityId, fieldName }
        }
      });

      if (fnError || result?.error) {
        console.error('Failed to delete custom field:', fnError || result?.error);
        return false;
      }

      // Update local state
      setFields(prev => prev.filter(f =>
        !(f.entity_type === entityType &&
          f.entity_id === entityId &&
          f.field_name === fieldName)
      ));

      setGrouped(prev => {
        const key = `${entityType}:${entityId}`;
        if (prev[key]) {
          const { [fieldName]: _, ...rest } = prev[key];
          return {
            ...prev,
            [key]: rest
          };
        }
        return prev;
      });

      return true;
    } catch (err) {
      console.error('Failed to delete custom field:', err);
      return false;
    }
  }, [accessToken]);

  const getFieldsForEntity = useCallback((
    entityType: 'campaign' | 'campaign_group',
    entityId: string
  ): Record<string, string> => {
    const key = `${entityType}:${entityId}`;
    return grouped[key] || {};
  }, [grouped]);

  const getFieldValue = useCallback((
    entityType: 'campaign' | 'campaign_group',
    entityId: string,
    fieldName: string
  ): string | undefined => {
    const key = `${entityType}:${entityId}`;
    return grouped[key]?.[fieldName];
  }, [grouped]);

  // Get unique field names used across all entities
  const uniqueFieldNames = useMemo(() => {
    const names = new Set<string>();
    fields.forEach(f => names.add(f.field_name));
    return Array.from(names).sort();
  }, [fields]);

  return {
    fields,
    grouped,
    isLoading,
    error,
    fetchCustomFields,
    setCustomField,
    deleteCustomField,
    getFieldsForEntity,
    getFieldValue,
    uniqueFieldNames,
  };
}
