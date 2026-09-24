/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 */
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface OptionItem {
  text: string;
  value: string;
}

interface OptionSelectProps {
  id: string;
  options: OptionItem[];
  value: OptionItem | null;
  onChange: (next: OptionItem | null) => void;
  placeholder?: string;
}

export function OptionSelect({ id, options, value, onChange, placeholder = 'Select…' }: OptionSelectProps) {
  return (
    <Select
      value={value?.value}
      onValueChange={(v) => {
        const found = options.find((o) => o.value === v);
        onChange(found ?? null);
      }}
    >
      <SelectTrigger id={id} size="default" className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
