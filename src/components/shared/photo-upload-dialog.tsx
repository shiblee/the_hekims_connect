"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Cropper, { type Area } from "react-easy-crop";
import { ImagePlus, Loader2, Check, Trash2, ZoomIn } from "lucide-react";
import { NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getCroppedImage, type CropArea } from "@/lib/image-crop";

const MAX_FILE_BYTES = 8 * 1024 * 1024;

/**
 * Generic upload-crop-save photo dialog, generalized from AvatarUploadDialog
 * (src/components/admin/avatar-upload-dialog.tsx) so it can save through any
 * API client — the caller owns the actual save/remove request.
 */
export function PhotoUploadDialog({
  open,
  onOpenChange,
  currentPhoto,
  onSave,
  onRemove,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPhoto?: string | null;
  onSave: (dataUrl: string) => Promise<void>;
  onRemove?: () => Promise<void>;
  title?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<CropArea | null>(null);
  const [saving, setSaving] = useState(false);
  const msg = useNotice();
  const t = useTranslations("common.widgets");
  const tc = useTranslations("common");

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedArea(areaPixels);
  }, []);

  const reset = () => {
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
    msg.clear();
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      msg.warning(t("photo_not_image"), t("photo_not_image_hint"));
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      msg.warning(t("photo_too_large"), t("photo_too_large_hint", { size: (file.size / 1024 / 1024).toFixed(1) }));
      return;
    }
    msg.clear();
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!imageSrc || !croppedArea) return;
    setSaving(true);
    try {
      const dataUrl = await getCroppedImage(imageSrc, croppedArea, 256);
      await onSave(dataUrl);
      reset(); // the new photo shows in place once the dialog closes
      onOpenChange(false);
    } catch (err: any) {
      msg.error(t("photo_not_saved"), t("try_again_detail", { detail: err.message || tc("network_error") }), { retry: save });
    } finally {
      setSaving(false);
    }
  };

  const removePhoto = async () => {
    if (!onRemove) return;
    setSaving(true);
    try {
      await onRemove();
      reset();
      onOpenChange(false);
    } catch (err: any) {
      msg.error(t("photo_not_removed"), t("try_again_detail", { detail: err.message || tc("network_error") }), { retry: removePhoto });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title ?? t("photo_title")}</DialogTitle>
          <DialogDescription>{t("photo_hint")}</DialogDescription>
        </DialogHeader>

        {!imageSrc ? (
          <div className="py-6">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/60 py-10 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
            >
              <ImagePlus className="h-8 w-8" />
              <span className="text-sm font-medium">{t("photo_choose")}</span>
              <span className="text-xs">{t("photo_types")}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative h-72 w-full rounded-lg overflow-hidden bg-black/40">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="flex items-center gap-3">
              <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          </div>
        )}

        <NoticeSlot state={msg} />
        <DialogFooter className="flex items-center sm:justify-between gap-2">
          {currentPhoto && !imageSrc ? (
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" disabled={saving} onClick={removePhoto}>
              <Trash2 className="h-4 w-4" /> {t("photo_remove")}
            </Button>
          ) : imageSrc ? (
            <Button type="button" variant="ghost" onClick={reset} disabled={saving}>{t("photo_other")}</Button>
          ) : (
            <span />
          )}
          {imageSrc && (
            <Button type="button" disabled={saving || !croppedArea} onClick={save}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {tc("save")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
