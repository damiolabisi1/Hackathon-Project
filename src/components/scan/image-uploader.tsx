"use client";

import Image from "next/image";
import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";

type ImageUploaderProps = {
  selectedImage: File | null;
  onImageSelect: (file: File | null) => void;
};

export function ImageUploader({
  selectedImage,
  onImageSelect,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedImage) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedImage);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedImage]);

  function validateAndSelect(file?: File) {
    setError("");

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("The image must be smaller than 10 MB.");
      return;
    }

    onImageSelect(file);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    validateAndSelect(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    validateAndSelect(event.dataTransfer.files?.[0]);
  }

  function removeImage() {
    onImageSelect(null);
    setError("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        capture="environment"
        className="hidden"
        onChange={handleInputChange}
      />

      {!previewUrl ? (
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-green-200 bg-green-50/40 px-8 py-12 text-center"
        >
          <span className="flex size-16 items-center justify-center rounded-2xl bg-green-100 text-green-700">
            <ImagePlus className="size-8" />
          </span>

          <h2 className="mt-6 text-xl font-bold">
            Upload your ingredient photo
          </h2>

          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            Drag and drop an image here, or select a clear photo of your fridge,
            pantry, or ingredients.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button type="button" onClick={() => inputRef.current?.click()}>
              <Camera className="size-4" />
              Take or select photo
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-4" />
              Browse files
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            JPG, PNG or WebP, up to 10 MB
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border bg-white p-4 shadow-sm">
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-muted">
            <Image
              src={previewUrl}
              alt="Selected ingredients"
              fill
              unoptimized
              className="object-cover"
            />
          </div>

          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate font-semibold">{selectedImage?.name}</p>

              <p className="text-sm text-muted-foreground">
                Ready for ingredient detection
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Remove selected image"
              onClick={removeImage}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm font-medium text-red-600">{error}</p>
      )}
    </div>
  );
}
