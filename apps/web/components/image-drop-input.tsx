"use client";

import { useCallback, useMemo } from "react";
import { ThumbImage } from "@/components/ui/thumb-image";
import { useDropzone } from "react-dropzone";
import type { MediaUploadStub } from "@colonus/shared";

interface ImageDropInputProps {
  label: string;
  multiple?: boolean;
  value?: MediaUploadStub;
  values?: MediaUploadStub[];
  onChange: (next?: MediaUploadStub) => void;
  onChangeMany?: (next: MediaUploadStub[]) => void;
}

export function ImageDropInput({
  label,
  multiple = false,
  value,
  values,
  onChange,
  onChangeMany
}: ImageDropInputProps) {
  const revokeIfBlobUrl = (url?: string) => {
    if (!url) return;
    if (!url.startsWith("blob:")) return;
    URL.revokeObjectURL(url);
  };

  const currentValues = multiple ? values ?? [] : value ? [value] : [];

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      const nextItems = acceptedFiles.map((file) => ({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        byteSize: file.size,
        localObjectUrl: URL.createObjectURL(file)
      }));

      if (multiple) {
        if (!onChangeMany) return;
        onChangeMany([...currentValues, ...nextItems]);
        return;
      }

      const file = nextItems[0];
      revokeIfBlobUrl(value?.localObjectUrl);
      onChange(file);
    },
    [currentValues, multiple, onChange, onChangeMany, value]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [],
      "application/pdf": []
    },
    multiple
  });

  const helper = useMemo(() => {
    if (currentValues.length > 0) {
      return multiple
        ? `Selected files: ${currentValues.length}`
        : `Selected: ${currentValues[0].fileName}`;
    }
    if (isDragActive) return "Drop image here";
    return multiple
      ? "Drag images/files here, or click to browse"
      : "Drag image/file here, or click to browse";
  }, [currentValues, isDragActive, multiple]);

  const removeAt = (index: number) => {
    const target = currentValues[index];
    revokeIfBlobUrl(target?.localObjectUrl);

    if (multiple) {
      if (!onChangeMany) return;
      onChangeMany(currentValues.filter((_, i) => i !== index));
      return;
    }
    onChange(undefined);
  };

  return (
    <div className="space-y-1">
      <label className="block text-xs uppercase tracking-wider text-slate-500">{label}</label>
      <div
        {...getRootProps()}
        className="cursor-pointer rounded border border-dashed border-slate-400 bg-slate-50 p-3 text-sm text-slate-700 transition hover:border-slate-600"
      >
        <input {...getInputProps()} />
        <p>{helper}</p>
      </div>
      {currentValues.length > 0 && (
        <div className="grid gap-2 md:grid-cols-2">
          {currentValues.map((item, index) => (
            <div key={`${item.fileName}-${index}`} className="overflow-hidden rounded border border-slate-200 bg-white">
              {item.mimeType.startsWith("image/") ? (
                <ThumbImage
                  src={item.localObjectUrl}
                  alt={`${label} preview ${index + 1}`}
                  className="h-36 bg-slate-50"
                  fit="contain"
                />
              ) : (
                <a
                  href={item.localObjectUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block p-3 text-xs text-slate-700 underline underline-offset-2"
                >
                  Open selected file ({item.fileName})
                </a>
              )}
              <button
                type="button"
                onClick={() => removeAt(index)}
                className="w-full border-t border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
