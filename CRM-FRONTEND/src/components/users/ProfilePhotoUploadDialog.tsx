import { useEffect, useRef, useState } from 'react';
import { Camera, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  useDeleteProfilePhotoMutation,
  useUploadProfilePhotoMutation,
} from '@/hooks/useProfilePhotoMutations';
import { resolveAssetUrl } from '@/utils/assetUrl';

// Same shape as Header.tsx getUserInitials — inlined to avoid forcing
// a refactor of Header in this change. Extract to @/utils/avatar if a
// third site needs it.
const getUserInitials = (name: string): string =>
  name
    .split(' ')
    .map((n) => n[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB — matches BE profilePhotoUpload middleware
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface Props {
  userId: string;
  userName: string;
  currentPhotoUrl: string | null | undefined;
  isSelf: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfilePhotoUploadDialog({
  userId,
  userName,
  currentPhotoUrl,
  isSelf,
  open,
  onOpenChange,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const uploadMutation = useUploadProfilePhotoMutation(userId, isSelf);
  const deleteMutation = useDeleteProfilePhotoMutation(userId, isSelf);
  const isBusy = uploadMutation.isPending || deleteMutation.isPending;

  // Reset state whenever the dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    }
    // intentionally not depending on previewUrl — only react to open changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Unsupported format. Use JPEG, PNG, or WEBP.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(`File too large. Max ${Math.round(MAX_BYTES / 1024 / 1024)} MB.`);
      e.target.value = '';
      return;
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = () => {
    if (!selectedFile) {
      return;
    }
    uploadMutation.mutate(selectedFile, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate(undefined, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const displayedAvatarSrc = previewUrl ?? resolveAssetUrl(currentPhotoUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isSelf ? 'Update Your Photo' : `Update Photo — ${userName}`}</DialogTitle>
          <DialogDescription>
            JPEG, PNG, or WEBP up to 2 MB. Image is resized to 512×512 server-side.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center space-y-4 py-2">
          <Avatar className="h-32 w-32">
            <AvatarImage src={displayedAvatarSrc} alt={userName} />
            <AvatarFallback className="text-2xl">{getUserInitials(userName)}</AvatarFallback>
          </Avatar>

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            className="hidden"
            onChange={handleSelect}
            disabled={isBusy}
            aria-label="Profile photo file"
          />

          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
          >
            <Camera className="mr-2 h-4 w-4" />
            {selectedFile ? 'Choose Different Photo' : 'Choose Photo'}
          </Button>

          {selectedFile && (
            <p className="text-xs text-muted-foreground">
              {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
            </p>
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <div>
            {currentPhotoUrl && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleDelete}
                disabled={isBusy}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {deleteMutation.isPending ? 'Removing…' : 'Remove Photo'}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isBusy}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleUpload} disabled={!selectedFile || isBusy}>
              <Upload className="mr-2 h-4 w-4" />
              {uploadMutation.isPending ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
