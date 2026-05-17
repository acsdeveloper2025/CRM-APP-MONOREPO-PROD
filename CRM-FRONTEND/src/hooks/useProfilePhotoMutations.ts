import { useQueryClient } from '@tanstack/react-query';
import { useStandardizedMutation } from '@/hooks/useStandardizedMutation';
import { useAuth } from '@/hooks/useAuth';
import { usersService } from '@/services/users';

/**
 * Profile photo upload + delete mutations.
 *
 * Both operations invalidate the user-detail and user-list query keys
 * so visible avatars refresh immediately. For self-update we also call
 * AuthContext.refreshUserPermissions which re-fetches /auth/me so the
 * Header avatar picks up the new URL without a page reload.
 */
export const useUploadProfilePhotoMutation = (userId: string, isSelf: boolean) => {
  const queryClient = useQueryClient();
  const { refreshUserPermissions } = useAuth();

  return useStandardizedMutation({
    mutationFn: (file: File) => usersService.uploadProfilePhoto(userId, file),
    successMessage: 'Profile photo updated',
    errorContext: 'Profile Photo Upload',
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      queryClient.invalidateQueries({ queryKey: ['user-profile', userId] });
      if (isSelf) {
        await refreshUserPermissions();
      }
    },
  });
};

export const useDeleteProfilePhotoMutation = (userId: string, isSelf: boolean) => {
  const queryClient = useQueryClient();
  const { refreshUserPermissions } = useAuth();

  return useStandardizedMutation({
    mutationFn: () => usersService.deleteProfilePhoto(userId),
    successMessage: 'Profile photo removed',
    errorContext: 'Profile Photo Delete',
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      queryClient.invalidateQueries({ queryKey: ['user-profile', userId] });
      if (isSelf) {
        await refreshUserPermissions();
      }
    },
  });
};
