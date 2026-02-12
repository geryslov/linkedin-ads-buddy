import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Plus, X, Save, Tag } from 'lucide-react';

interface CustomFieldEditorProps {
  entityType: 'campaign' | 'campaign_group';
  entityId: string;
  entityName: string;
  currentFields: Record<string, string>;
  onSave: (fieldName: string, fieldValue: string) => Promise<boolean>;
  onDelete: (fieldName: string) => Promise<boolean>;
  existingFieldNames?: string[];
}

export function CustomFieldEditor({
  entityType,
  entityId,
  entityName,
  currentFields,
  onSave,
  onDelete,
  existingFieldNames = []
}: CustomFieldEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fieldEntries = Object.entries(currentFields);

  const handleAddField = async () => {
    if (!newFieldName.trim()) return;

    setIsSaving(true);
    setError(null);
    const success = await onSave(newFieldName.trim(), newFieldValue);
    if (success) {
      setNewFieldName('');
      setNewFieldValue('');
    } else {
      setError('Failed to save field. Please check your connection.');
    }
    setIsSaving(false);
  };

  const handleUpdateField = async (fieldName: string) => {
    setIsSaving(true);
    setError(null);
    const success = await onSave(fieldName, editValue);
    if (success) {
      setEditingField(null);
      setEditValue('');
    } else {
      setError('Failed to update field. Please check your connection.');
    }
    setIsSaving(false);
  };

  const handleDeleteField = async (fieldName: string) => {
    setIsSaving(true);
    setError(null);
    const success = await onDelete(fieldName);
    if (!success) {
      setError('Failed to delete field. Please check your connection.');
    }
    setIsSaving(false);
  };

  const startEditing = (fieldName: string, currentValue: string) => {
    setEditingField(fieldName);
    setEditValue(currentValue);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-muted-foreground hover:text-foreground"
        >
          <Tag className="h-3 w-3 mr-1" />
          {fieldEntries.length > 0 ? fieldEntries.length : <Plus className="h-3 w-3" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="font-medium text-sm">Custom Fields</h4>
            <p className="text-xs text-muted-foreground truncate" title={entityName}>
              {entityType === 'campaign_group' ? 'Campaign Group' : 'Campaign'}: {entityName}
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="text-xs text-destructive bg-destructive/10 px-2 py-1 rounded">
              {error}
            </div>
          )}

          {/* Existing fields */}
          {fieldEntries.length > 0 && (
            <div className="space-y-2">
              {fieldEntries.map(([name, value]) => (
                <div key={name} className="flex items-center gap-2">
                  {editingField === name ? (
                    <>
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="h-8 flex-1"
                        placeholder="Value"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => handleUpdateField(name)}
                        disabled={isSaving}
                      >
                        <Save className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => setEditingField(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-muted-foreground">{name}:</span>
                        <span
                          className="ml-1 text-sm cursor-pointer hover:underline truncate block"
                          onClick={() => startEditing(name, value)}
                          title={`Click to edit: ${value}`}
                        >
                          {value || '(empty)'}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteField(name)}
                        disabled={isSaving}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add new field */}
          <div className="border-t pt-3 space-y-2">
            <Label className="text-xs">Add New Field</Label>
            <div className="flex gap-2">
              <Input
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                className="h-8"
                placeholder="Field name"
                list="field-names"
              />
              <datalist id="field-names">
                {existingFieldNames
                  .filter(n => !currentFields[n])
                  .map(name => (
                    <option key={name} value={name} />
                  ))
                }
              </datalist>
            </div>
            <div className="flex gap-2">
              <Input
                value={newFieldValue}
                onChange={(e) => setNewFieldValue(e.target.value)}
                className="h-8 flex-1"
                placeholder="Value"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddField();
                }}
              />
              <Button
                size="sm"
                className="h-8"
                onClick={handleAddField}
                disabled={!newFieldName.trim() || isSaving}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
